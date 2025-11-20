/**
 * Main function to generate course recommendations - GPT-first approach
 * @param {Object} preferences - User preferences from RecommendMe form
 * @param {Array} allClasses - All available classes from database
 * @param {Object} degreeData - Degree requirements data
 * @param {Array} takenCourses - Courses user has already taken
 * @param {Array} plannedClasses - Courses already in planner
 * @param {Object} prerequisitesMap - Map of courseCode -> prerequisite data
 * @returns {Array} Recommended courses sorted by GPT
 */
export function generateRecommendations({
  preferences,
  allClasses,
  degreeData,
  takenCourses = [],
  plannedClasses = [],
  prerequisitesMap = {}
}) {
  console.log('🎯 Starting GPT-first recommendation generation...');
  console.log('📊 Input stats:', {
    totalClasses: allClasses.length,
    takenCourses: takenCourses.length,
    plannedClasses: plannedClasses.length,
    prerequisitesMap: Object.keys(prerequisitesMap).length
  });

  // Just filter out already taken/planned courses
  const takenCodes = new Set(takenCourses.map(c => c.courseCode || c.code));
  const plannedCodes = new Set(plannedClasses.map(c => c.code));

  const availableClasses = allClasses.filter(cls => 
    !takenCodes.has(cls.code) && !plannedCodes.has(cls.code)
  );

  console.log(`✓ Available classes: ${availableClasses.length}`);

  // Identify needed courses for context
  const neededCourses = identifyNeededCourses(degreeData, takenCourses, plannedClasses);

  // Add basic metadata to each class
  const enrichedClasses = availableClasses.map(cls => ({
    ...cls,
    prerequisiteInfo: prerequisitesMap[cls.code] || { hasPrerequisites: false },
    isRequired: neededCourses.codes.has(cls.code),
    priority: neededCourses.priorities[cls.code] || 0
  }));

  return enrichedClasses;
}

/**
 * Enhanced GPT function that does ALL the recommendation logic
 */
export async function enhanceWithGPT(allClasses, context) {
  console.log('🤖 Starting GPT-powered recommendations...');
  console.log('Total classes to analyze:', allClasses.length);
  
  if (!allClasses || allClasses.length === 0) {
    console.log('⚠️ No classes to recommend');
    return [];
  }
  
  const { preferences, degreeData, takenCourses, plannedClasses } = context;
  
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'sk-your-actual-key-here' || apiKey.length < 20) {
    console.warn('⚠️ No valid OpenAI API key found, returning basic list');
    return allClasses.slice(0, 10);
  }

  // Build comprehensive course data for GPT
  const courseData = allClasses.map(cls => {
    const avgRating = getAverageRating(cls);
    const prereqInfo = cls.prerequisiteInfo || {};
    
    return {
      code: cls.code,
      name: cls.name,
      hours: cls.hours || 3,
      professors: cls.professors?.join(', ') || 'TBA',
      schedule: cls.schedule ? 
        `${cls.schedule.days?.join('/') || 'TBA'} ${cls.schedule.startTime || ''}-${cls.schedule.endTime || ''}`.trim() : 
        'TBA',
      rmpQuality: avgRating?.quality?.toFixed(1) || 'N/A',
      rmpDifficulty: avgRating?.difficulty?.toFixed(1) || 'N/A',
      isRequired: cls.isRequired || false,
      hasPrereqs: prereqInfo.hasPrerequisites || false,
      prereqType: prereqInfo.prerequisiteType || 'none',
      prereqCourses: prereqInfo.prerequisiteCourses?.join(', ') || 'None'
    };
  });

  // Create detailed prompt
  const prompt = `You are an expert academic advisor. Analyze ALL ${courseData.length} courses and recommend the top 10-15 courses for this student.

STUDENT PROFILE:
Major: ${degreeData?.major || 'Computer Science'}
Courses Taken: ${takenCourses?.map(c => c.courseCode || c.code).join(', ') || 'None'}
Courses Planned: ${plannedClasses?.map(c => c.code).join(', ') || 'None'}

STUDENT PREFERENCES:
- Workload: ${preferences.workload} (easier/balanced/challenging)
- Week Pattern: ${preferences.weekPattern} (heavier_mwf/heavier_tr/balanced_days)
- Avoiding Professors: ${preferences.avoidProfessors?.join(', ') || 'None'}
- Blocked Time Slots: ${preferences.blockedSlots?.join(', ') || 'None'}

ALL AVAILABLE COURSES:
${courseData.map((c, i) => `${i + 1}. ${c.code} - ${c.name}
   Hours: ${c.hours} | Required: ${c.isRequired ? 'YES' : 'No'}
   Professors: ${c.professors} | Schedule: ${c.schedule}
   RMP: Quality ${c.rmpQuality}/5.0, Difficulty ${c.rmpDifficulty}/5.0
   Prerequisites: ${c.hasPrereqs ? `${c.prereqType.toUpperCase()}: ${c.prereqCourses}` : 'None'}`).join('\n\n')}

INSTRUCTIONS:
1. Check prerequisites - student must have completed required courses (taken or planned)
2. Prioritize courses marked as "Required: YES"
3. Match schedule preferences (avoid blocked times, prefer their week pattern)
4. Match workload preference using RMP difficulty ratings
5. Avoid professors on their avoid list
6. Balance the schedule with a mix of required and interesting electives
7. Consider professor ratings (aim for 4.0+ quality when possible)

Return EXACTLY 10-15 courses as a JSON array. Use EXACT course codes from the list above:

[
  {
    "courseCode": "exact code from above",
    "rank": 1,
    "confidence": "high/medium/low",
    "reasoning": "One sentence explaining why this is a great fit for this student",
    "warning": "Any concerns (prerequisites, difficult prof, bad time slot) or null"
  }
]`;

  console.log('Making API call to OpenAI...');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

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
            content: 'You are an expert academic advisor. Analyze all courses comprehensively and return ONLY a valid JSON array. Consider prerequisites, schedule fit, workload preferences, and degree requirements.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 4000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('✓ Got response, status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      return allClasses.slice(0, 10);
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error.message);
      return allClasses.slice(0, 10);
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected API response structure');
      return allClasses.slice(0, 10);
    }

    const parsedText = data.choices[0].message.content.trim();
    console.log('✓ Got content, length:', parsedText.length);
    
    const cleanedText = parsedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let gptRankings;
    try {
      gptRankings = JSON.parse(cleanedText);
      console.log('✓ Parsed GPT rankings:', gptRankings.length);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      return allClasses.slice(0, 10);
    }

    if (!Array.isArray(gptRankings) || gptRankings.length === 0) {
      console.warn('⚠️ GPT returned invalid or empty array');
      return allClasses.slice(0, 10);
    }

    // Match GPT recommendations back to original course objects
    const recommendations = gptRankings
      .map(gptRec => {
        const course = allClasses.find(c => 
          c.code.toUpperCase() === gptRec.courseCode.toUpperCase()
        );
        
        if (!course) {
          console.warn('Could not find course:', gptRec.courseCode);
          return null;
        }
        
        return {
          ...course,
          gptRank: gptRec.rank,
          gptConfidence: gptRec.confidence,
          gptReasoning: gptRec.reasoning,
          gptWarning: gptRec.warning,
          isGPTEnhanced: true,
          score: 100 - gptRec.rank // Synthetic score for sorting
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.gptRank - b.gptRank);

    console.log(`✅ GPT recommended ${recommendations.length} courses`);
    return recommendations;

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('⏱️ GPT request timed out after 90 seconds');
    } else {
      console.error('❌ GPT enhancement failed:', error.message);
    }
    return allClasses.slice(0, 10);
  }
}

/**
 * Helper to get average RMP rating for a class
 */
function getAverageRating(cls) {
  if (!cls.rmpData || Object.keys(cls.rmpData).length === 0) {
    return null;
  }

  const ratings = Object.values(cls.rmpData);
  const qualities = ratings.filter(r => r.quality != null).map(r => r.quality);
  const difficulties = ratings.filter(r => r.difficulty != null).map(r => r.difficulty);

  if (qualities.length === 0) return null;

  return {
    quality: qualities.reduce((sum, q) => sum + q, 0) / qualities.length,
    difficulty: difficulties.length > 0
      ? difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length
      : null
  };
}

/**
 * Identify which courses the student still needs based on degree requirements
 */
function identifyNeededCourses(degreeData, takenCourses, plannedClasses) {
  if (!degreeData || !degreeData.categories) {
    return { codes: new Set(), categories: {}, priorities: {} };
  }

  const allCompleted = [
    ...takenCourses.map(tc => tc.courseCode || tc.code),
    ...plannedClasses.map(pc => pc.code)
  ];
  const completedSet = new Set(allCompleted);

  const needed = {
    codes: new Set(),
    categories: {},
    priorities: {}
  };

  degreeData.categories.forEach(category => {
    const categoryNeeds = {
      name: category.name,
      requiredHours: category.requiredHours,
      minCourses: category.minCourses,
      earnedHours: 0,
      availableCourses: []
    };

    category.availableClasses.forEach(cls => {
      if (completedSet.has(cls.code)) {
        categoryNeeds.earnedHours += cls.hours || 3;
      }
    });

    if (categoryNeeds.earnedHours < category.requiredHours) {
      category.availableClasses.forEach(cls => {
        if (!completedSet.has(cls.code)) {
          needed.codes.add(cls.code);
          categoryNeeds.availableCourses.push(cls.code);
          needed.priorities[cls.code] = cls.required ? 3 : 
            (category.minCourses ? 2 : 1);
        }
      });
    }

    if (categoryNeeds.availableCourses.length > 0) {
      needed.categories[category.name] = categoryNeeds;
    }
  });

  return needed;
}

/**
 * Format recommendations for display
 */
export function formatRecommendation(cls) {
  const reasons = [];
  
  if (cls.gptReasoning) {
    reasons.push(cls.gptReasoning);
  }
  
  if (cls.isRequired) {
    reasons.push('Required for your degree');
  }

  const avgRating = getAverageRating(cls);
  if (avgRating && avgRating.quality >= 4.0) {
    reasons.push(`Highly rated (${avgRating.quality.toFixed(1)}/5.0)`);
  }

  return {
    ...cls,
    recommendationReasons: reasons,
    matchScore: cls.score
  };
}