/**
 * Fixed Hybrid Course Recommendation Engine
 * Fixes: Duplicates, prereqs, RMP data, and better prompt
 */


// Rate limiting
let lastGPTCall = 0;
const MIN_DELAY = 10000; // 10 seconds between calls

export function generateRecommendations({
  preferences,
  allClasses,
  degreeData,
  takenCourses = [],
  plannedClasses = [],
  prerequisitesMap = {}
}) {
  console.log('🎯 Starting hybrid recommendation generation...');
  
  // FIXED: Normalize course codes consistently
  const normalizeCode = (code) => code?.toUpperCase().replace(/\s+/g, '').trim();
  
  const takenCodes = new Set(takenCourses.map(c => normalizeCode(c.courseCode || c.code)));
  const plannedCodes = new Set(plannedClasses.map(c => normalizeCode(c.code)));
  const completedCourses = new Set([...takenCodes, ...plannedCodes]);

  console.log('✓ Taken courses:', Array.from(takenCodes));
  console.log('✓ Planned courses:', Array.from(plannedCodes));

  // FIXED: Better filtering with normalized codes
  const availableClasses = allClasses.filter(cls => {
    const normalizedCode = normalizeCode(cls.code);
    
    // Skip if already taken or planned
    if (takenCodes.has(normalizedCode) || plannedCodes.has(normalizedCode)) {
      console.log(`⏭️ Skipping ${cls.code} - already taken/planned`);
      return false;
    }
    
    // FIXED: Check prerequisites properly
    const prereqData = prerequisitesMap[cls.code];
    if (prereqData?.hasPrerequisites) {
      const meetsPrereqs = checkPrerequisites(prereqData, completedCourses);
      if (!meetsPrereqs) {
        console.log(`⏭️ Skipping ${cls.code} - prerequisites not met`);
        return false;
      }
    }
    
    return true;
  });

  console.log(`✓ After basic filtering: ${availableClasses.length} classes`);

  const neededCourses = identifyNeededCourses(degreeData, takenCourses, plannedClasses);

  const candidates = smartPreFilter(
    availableClasses,
    preferences,
    neededCourses,
    prerequisitesMap
  );

  console.log(`✓ Smart pre-filter selected: ${candidates.length} candidates for GPT`);

  return { candidates, neededCourses };
}

function smartPreFilter(classes, preferences, neededCourses, prerequisitesMap) {
  // Step 1: First deduplicate at the start
  const uniqueCandidates = [];
  const seenCodes = new Set();
  
  for (const cls of classes) {
    const normalizedCode = cls.code.toUpperCase().replace(/\s+/g, '');
    if (!seenCodes.has(normalizedCode)) {
      seenCodes.add(normalizedCode);
      uniqueCandidates.push(cls);
    }
  }
  
  console.log(`✓ Deduplicated: ${classes.length} → ${uniqueCandidates.length} unique courses`);
  
  // Step 2: Now filter and score the unique courses
  const filtered = uniqueCandidates.map(cls => {
    let priority = 0;
    
    // Avoid professors
    if (cls.professors?.some(prof =>
      preferences.avoidProfessors?.some(avoided =>
        prof.toLowerCase().includes(avoided.toLowerCase())
      )
    )) {
      console.log(`⏭️ Filtering out ${cls.code} - professor on avoid list`);
      return null;
    }

    // No undergrad research
    const researchCodes = ['2860', '3860', '3861'];
    if (researchCodes.some(code => cls.code.includes(code)) ||
        cls.name?.toLowerCase().includes('undergraduate research')) {
      console.log(`⏭️ Filtering out ${cls.code} - undergrad research`);
      return null;
    }
    
    // Check blocked time slots
    if (cls.schedule?.startTime && !cls.schedule.startTime.includes('NaN')) {
      const startHour = parseInt(cls.schedule.startTime.split(':')[0]);
      const isBlocked = preferences.blockedSlots?.some(slot => {
        const ranges = {
          'early_morning': [8, 10],
          'late_morning': [10, 12],
          'lunch': [12, 14],
          'early_afternoon': [14, 16],
          'late_afternoon': [16, 18],
          'evening': [18, 20]
        };
        const [min, max] = ranges[slot] || [0, 0];
        return startHour >= min && startHour < max;
      });
      
      if (isBlocked) {
        console.log(`⏭️ Filtering out ${cls.code} - blocked time slot`);
        return null;
      }
    }
    
    // Filter out broken schedules
    if (cls.schedule?.startTime?.includes('NaN')) {
      console.log(`⏭️ Filtering out ${cls.code} - broken schedule`);
      return null;
    }
    
    // Priority for required courses
    if (neededCourses.codes.has(cls.code)) {
      const coursePriority = neededCourses.priorities[cls.code] || 1;
      priority += coursePriority * 30;
    } else {
      priority += 10;
    }
    
    // Use RMP data properly
    const avgRating = getAverageRating(cls);
    if (avgRating?.quality) {
      if (avgRating.quality >= 4.5) priority += 20;
      else if (avgRating.quality >= 4.0) priority += 15;
      else if (avgRating.quality >= 3.5) priority += 10;
      else if (avgRating.quality < 2.5) priority -= 10;
    }
    
    // Workload preferences
    if (avgRating?.difficulty) {
      const diff = avgRating.difficulty;
      if (preferences.workload === 'easier' && diff <= 2.5) priority += 10;
      else if (preferences.workload === 'challenging' && diff >= 3.5) priority += 10;
      else if (preferences.workload === 'balanced' && diff >= 2.5 && diff <= 3.5) priority += 10;
    }
    
    // Schedule pattern preferences
    if (cls.schedule?.days) {
      const hasMWF = cls.schedule.days.some(d => ['Monday', 'Wednesday', 'Friday'].includes(d));
      const hasTR = cls.schedule.days.some(d => ['Tuesday', 'Thursday'].includes(d));
      
      if (preferences.weekPattern === 'heavier_mwf' && hasMWF) priority += 8;
      else if (preferences.weekPattern === 'heavier_tr' && hasTR) priority += 8;
      else if (preferences.weekPattern === 'balanced_days') priority += 5;
    }
    
    // Deprioritize 1-credit labs
    if (cls.hours === 1 || cls.name?.toLowerCase().includes('laboratory')) {
      priority -= 15;
    }
    
    return { ...cls, priority };
  }).filter(Boolean);

  console.log(`✓ After filtering: ${filtered.length} courses`);

  // Step 3: Sort by priority and take top 100
  const top100 = filtered
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 100);
    
  console.log(`✓ Returning top 100 candidates`);
  
  return top100;
}

export async function enhanceWithGPT(candidatesData, context) {
  const candidates = Array.isArray(candidatesData) ? candidatesData : candidatesData.candidates;
  const neededCourses = candidatesData.neededCourses || context.neededCourses;
  
  console.log('🤖 Starting GPT enhancement with', candidates?.length || 0, 'pre-filtered candidates');
  
  if (!candidates || candidates.length === 0) {
    console.log('⚠️ No candidates to enhance');
    return [];
  }
  
  const { preferences, degreeData, takenCourses, plannedClasses, prerequisitesMap } = context;
  
  const primaryKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
  const secondaryKey = import.meta.env.VITE_OPENAI_API_KEY_2 || import.meta.env.OPENAI_API_KEY_2;
  
  let apiKey = null;
  let keySource = null;
  
  if (primaryKey && primaryKey !== 'sk-your-actual-key-here' && primaryKey.length >= 20) {
    apiKey = primaryKey;
    keySource = 'primary';
  } else if (secondaryKey && secondaryKey !== 'sk-your-actual-key-here' && secondaryKey.length >= 20) {
    apiKey = secondaryKey;
    keySource = 'secondary';
    console.log('⚠️ Using secondary API key (primary key invalid)');
  }
  
  if (!apiKey) {
    console.warn('⚠️ No valid API keys available, returning top 15 candidates');
    return candidates.slice(0, 15);
  }
  
  console.log(`🔑 Using ${keySource} API key`);

  // // FIXED: Remove duplicates by course code before sending to GPT
  // const uniqueCandidates = [];
  // const seenCodes = new Set();
  
  // for (const cls of candidates) {
  //   const normalizedCode = cls.code.toUpperCase().replace(/\s+/g, '');
  //   if (!seenCodes.has(normalizedCode)) {
  //     seenCodes.add(normalizedCode);
  //     uniqueCandidates.push(cls);
  //   }
  // }
  
  // console.log(`✓ Deduplicated: ${candidates.length} → ${uniqueCandidates.length} unique courses`);
const uniqueCandidates = candidates;
  const courseData = uniqueCandidates.map(cls => {
    const avgRating = getAverageRating(cls);
    const prereqInfo = prerequisitesMap?.[cls.code] || {};
    
    return {
      code: cls.code,
      name: cls.name,
      hrs: cls.hours || 3,
      prof: cls.professors?.join(', ') || 'TBA',
      sched: cls.schedule ? 
        `${cls.schedule.days?.join('/') || 'TBA'} ${cls.schedule.startTime || ''}-${cls.schedule.endTime || ''}`.trim() : 
        'TBA',
      rmp: avgRating ? `${avgRating.quality.toFixed(1)}/${avgRating.difficulty.toFixed(1)}` : 'N/A',
      req: cls.priority > 50 ? 'YES' : 'No',
      prereqCourses: prereqInfo.prerequisiteCourses?.join(',') || 'None'
    };
  });

  const totalRequired = degreeData?.totalRequiredHours || 120;
  const completedHours = (takenCourses?.length || 0) * 3;
  const progressPercent = Math.round((completedHours / totalRequired) * 100);
  
  const categoryStatus = Object.entries(neededCourses?.categories || {})
    .slice(0, 5)
    .map(([name, data]) => 
      `${name}: ${data.earnedHours}/${data.requiredHours}h earned`
    )
    .join(', ');

  // FIXED: Better prompt with explicit instructions
  const prompt = `You are an academic advisor ranking courses for a ${degreeData?.major || 'CS'} student.

STUDENT STATUS:
- Progress: ${progressPercent}% (${completedHours}/${totalRequired} hours)
- Requirements: ${categoryStatus || 'Not available'}
- Completed: ${takenCourses?.map(c => c.courseCode || c.code).join(', ') || 'None'}
- Planned: ${plannedClasses?.map(c => c.code).join(', ') || 'None'}

PREFERENCES:
- Workload: ${preferences.workload}
- Schedule: ${preferences.weekPattern}
- Avoid professors: ${preferences.avoidProfessors?.join(', ') || 'None'}

STRICT RULES - MUST FOLLOW:
1. Return EXACTLY 15 courses, no more, no less
2. Use EXACT course codes from the list (copy/paste, don't modify)
3. NO duplicates - each course code should appear ONLY ONCE
4. NO courses student has taken: ${takenCourses?.map(c => c.courseCode || c.code).join(', ') || 'None'}
5. NO courses student planned: ${plannedClasses?.map(c => c.code).join(', ') || 'None'}
6. NO undergraduate research (CS 2860, CS 3860, CS 3861)
7. Prioritize 3-credit courses over 1-credit labs
8. If multiple sections exist, pick the ONE best section only

AVAILABLE COURSES (${courseData.length} options):
${courseData.map((c, i) => 
  `${i + 1}. ${c.code} | ${c.name} | ${c.hrs}h | Prof: ${c.prof} | ${c.sched} | RMP: ${c.rmp} | Required: ${c.req} | Prereqs: ${c.prereqCourses}`
).join('\n')}

Return valid JSON array with EXACTLY 15 courses:
[{"courseCode":"EXACT_CODE_FROM_LIST","rank":1,"confidence":"high|medium|low","reasoning":"One sentence why this course","warning":null}]

Double-check:
✓ Exactly 15 courses
✓ No duplicates
✓ Only codes from the list above
✓ None the student has taken/planned`;

  // console.log('📤 Sending prompt with', uniqueCandidates.length, 'unique courses');
  console.log('PROMPT: ', prompt);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // Rate limiting
    const timeSince = Date.now() - lastGPTCall;
    if (timeSince < MIN_DELAY) {
      await new Promise(r => setTimeout(r, MIN_DELAY - timeSince));
    }
    lastGPTCall = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an academic advisor. Return ONLY valid JSON array. Use exact course codes provided. No duplicates allowed.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, // Lower temperature for more consistent output
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ API Error with ${keySource} key:`, response.status, error);
      
      // If we used primary key and have a secondary key, try it
      if (keySource === 'primary' && secondaryKey) {
        console.log('🔄 Trying secondary API key...');
        
        const timeSince2 = Date.now() - lastGPTCall;
        if (timeSince2 < MIN_DELAY) {
          await new Promise(r => setTimeout(r, MIN_DELAY - timeSince2));
        }
        lastGPTCall = Date.now();
        
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 60000);
        
        const response2 = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secondaryKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: 'You are an academic advisor. Return ONLY valid JSON array. Use exact course codes provided. No duplicates allowed.' 
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 2000
          }),
          signal: controller2.signal
        });
        
        clearTimeout(timeoutId2);
        
        if (!response2.ok) {
          console.error('❌ Secondary key also failed');
          return uniqueCandidates.slice(0, 15);
        }
        
        console.log('✅ Secondary key succeeded!');
        const data2 = await response2.json();
        const parsedText = data2.choices[0].message.content.trim();
        const cleanedText = parsedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const gptRankings = JSON.parse(cleanedText);
        
        // Continue with the same processing logic below...
        console.log('✓ GPT returned', gptRankings.length, 'recommendations');
        const normalizeCode = (code) => code?.toUpperCase().replace(/\s+/g, '');
        const seenInResults = new Set();
        const takenSet = new Set(takenCourses.map(c => normalizeCode(c.courseCode || c.code)));
        const plannedSet = new Set(plannedClasses.map(c => normalizeCode(c.code)));

        const recommendations = gptRankings
          .map(gptRec => {
            const normalizedGptCode = normalizeCode(gptRec.courseCode);
            
            if (takenSet.has(normalizedGptCode) || plannedSet.has(normalizedGptCode)) {
              console.warn('❌ GPT recommended taken/planned course:', gptRec.courseCode);
              return null;
            }
            
            if (seenInResults.has(normalizedGptCode)) {
              console.warn('❌ GPT returned duplicate:', gptRec.courseCode);
              return null;
            }
            seenInResults.add(normalizedGptCode);
            
            const course = uniqueCandidates.find(c => {
              const normalizedCourseCode = normalizeCode(c.code);
              return normalizedCourseCode === normalizedGptCode;
            });
            
            if (!course) {
              console.warn('❌ GPT returned unknown code:', gptRec.courseCode);
              return null;
            }
            
            return {
              ...course,
              gptRank: gptRec.rank,
              gptConfidence: gptRec.confidence,
              gptReasoning: gptRec.reasoning,
              gptWarning: gptRec.warning,
              isGPTEnhanced: true,
              score: 100 - gptRec.rank
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.gptRank - b.gptRank);

        if (recommendations.length < 15) {
          const usedCodes = new Set(recommendations.map(r => normalizeCode(r.code)));
          const remaining = uniqueCandidates
            .filter(c => !usedCodes.has(normalizeCode(c.code)))
            .slice(0, 15 - recommendations.length)
            .map((c, i) => ({
              ...c,
              gptRank: recommendations.length + i + 1,
              gptConfidence: 'medium',
              gptReasoning: 'Fallback recommendation based on pre-filtering',
              isGPTEnhanced: false,
              score: 50 - i
            }));
          
          return [...recommendations, ...remaining];
        }
        
        return recommendations.slice(0, 15);
      }
      
      return uniqueCandidates.slice(0, 15);
    }

    const data = await response.json();
    const parsedText = data.choices[0].message.content.trim();
    const cleanedText = parsedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const gptRankings = JSON.parse(cleanedText);
    console.log('✓ GPT returned', gptRankings.length, 'recommendations');

    // FIXED: Strict validation and deduplication
    const normalizeCode = (code) => code?.toUpperCase().replace(/\s+/g, '');
    const seenInResults = new Set();
    const takenSet = new Set(takenCourses.map(c => normalizeCode(c.courseCode || c.code)));
    const plannedSet = new Set(plannedClasses.map(c => normalizeCode(c.code)));

    const recommendations = gptRankings
      .map(gptRec => {
        const normalizedGptCode = normalizeCode(gptRec.courseCode);
        
        // Validate not already taken/planned
        if (takenSet.has(normalizedGptCode) || plannedSet.has(normalizedGptCode)) {
          console.warn('❌ GPT recommended taken/planned course:', gptRec.courseCode);
          return null;
        }
        
        // Validate no duplicates in results
        if (seenInResults.has(normalizedGptCode)) {
          console.warn('❌ GPT returned duplicate:', gptRec.courseCode);
          return null;
        }
        seenInResults.add(normalizedGptCode);
        
        const course = uniqueCandidates.find(c => {
          const normalizedCourseCode = normalizeCode(c.code);
          return normalizedCourseCode === normalizedGptCode;
        });
        
        if (!course) {
          console.warn('❌ GPT returned unknown code:', gptRec.courseCode);
          return null;
        }
        
        return {
          ...course,
          gptRank: gptRec.rank,
          gptConfidence: gptRec.confidence,
          gptReasoning: gptRec.reasoning,
          gptWarning: gptRec.warning,
          isGPTEnhanced: true,
          score: 100 - gptRec.rank
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.gptRank - b.gptRank);

    console.log(`✅ Final validated recommendations: ${recommendations.length}`);
    
    // If we got fewer than 15, fill in with top candidates
    if (recommendations.length < 15) {
      console.log(`⚠️ Only got ${recommendations.length} from GPT, filling remaining slots`);
      const usedCodes = new Set(recommendations.map(r => normalizeCode(r.code)));
      const remaining = uniqueCandidates
        .filter(c => !usedCodes.has(normalizeCode(c.code)))
        .slice(0, 15 - recommendations.length)
        .map((c, i) => ({
          ...c,
          gptRank: recommendations.length + i + 1,
          gptConfidence: 'medium',
          gptReasoning: 'Fallback recommendation based on pre-filtering',
          isGPTEnhanced: false,
          score: 50 - i
        }));
      
      return [...recommendations, ...remaining];
    }
    
    return recommendations.slice(0, 15);

  } catch (error) {
    console.error('❌ GPT failed:', error.message);
    return uniqueCandidates.slice(0, 15);
  }
}

function checkPrerequisites(prereqData, completedCourses) {
  if (!prereqData.hasPrerequisites || !prereqData.prerequisiteCourses?.length) {
    return true;
  }
  
  const { prerequisiteType, prerequisiteCourses } = prereqData;
  const normalizeCode = (code) => code?.toUpperCase().replace(/\s+/g, '');
  
  // Normalize both sets for comparison
  const normalizedCompleted = new Set(
    Array.from(completedCourses).map(c => normalizeCode(c))
  );
  const normalizedPrereqs = prerequisiteCourses.map(p => normalizeCode(p));
  
  console.log('Checking prereqs:', {
    required: normalizedPrereqs,
    completed: Array.from(normalizedCompleted),
    type: prerequisiteType
  });
  
  if (prerequisiteType === 'or') {
    return normalizedPrereqs.some(prereq => normalizedCompleted.has(prereq));
  }
  
  return normalizedPrereqs.every(prereq => normalizedCompleted.has(prereq));
}

function getAverageRating(cls) {
  // FIXED: Better RMP data handling
  if (!cls.rmpData || typeof cls.rmpData !== 'object') {
    return null;
  }

  const ratings = Object.values(cls.rmpData);
  
  if (ratings.length === 0) {
    return null;
  }

  const qualities = ratings.filter(r => r?.quality != null && !isNaN(r.quality)).map(r => r.quality);
  const difficulties = ratings.filter(r => r?.difficulty != null && !isNaN(r.difficulty)).map(r => r.difficulty);

  if (qualities.length === 0) {
    return null;
  }

  return {
    quality: qualities.reduce((sum, q) => sum + q, 0) / qualities.length,
    difficulty: difficulties.length > 0
      ? difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length
      : null,
    numRatings: ratings.length
  };
}

function identifyNeededCourses(degreeData, takenCourses, plannedClasses) {
  if (!degreeData?.categories) {
    return { codes: new Set(), categories: {}, priorities: {} };
  }

  const normalizeCode = (code) => code?.toUpperCase().replace(/\s+/g, '');
  const completedSet = new Set([
    ...takenCourses.map(tc => normalizeCode(tc.courseCode || tc.code)),
    ...plannedClasses.map(pc => normalizeCode(pc.code))
  ]);

  const needed = {
    codes: new Set(),
    categories: {},
    priorities: {}
  };

  degreeData.categories.forEach(category => {
    let earnedHours = 0;
    
    category.availableClasses.forEach(cls => {
      if (completedSet.has(normalizeCode(cls.code))) {
        earnedHours += cls.hours || 3;
      }
    });

    needed.categories[category.name] = {
      requiredHours: category.requiredHours,
      earnedHours
    };

    if (earnedHours < category.requiredHours) {
      category.availableClasses.forEach(cls => {
        const normalizedCode = normalizeCode(cls.code);
        if (!completedSet.has(normalizedCode)) {
          needed.codes.add(cls.code);
          needed.priorities[cls.code] = cls.required ? 3 : 
            (category.minCourses ? 2 : 1);
        }
      });
    }
  });

  return needed;
}

export function formatRecommendation(cls) {
  const reasons = [];
  
  if (cls.gptReasoning) {
    reasons.push(cls.gptReasoning);
  }
  
  if (cls.priority > 50) {
    reasons.push('Required for your degree');
  }

  const avgRating = getAverageRating(cls);
  if (avgRating?.quality >= 4.0) {
    reasons.push(`Highly rated (${avgRating.quality.toFixed(1)}/5.0 from ${avgRating.numRatings} reviews)`);
  }

  return {
    ...cls,
    recommendationReasons: reasons,
    matchScore: cls.score
  };
}