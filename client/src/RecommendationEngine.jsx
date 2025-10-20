/**
 * Main function to generate course recommendations
 * @param {Object} preferences - User preferences from RecommendMe form
 * @param {Array} allClasses - All available classes from database
 * @param {Object} degreeData - Degree requirements data
 * @param {Array} takenCourses - Courses user has already taken
 * @param {Array} plannedClasses - Courses already in planner
 * @returns {Array} Recommended courses sorted by score
 */
// export function generateRecommendations({
//     preferences,
//     allClasses,
//     degreeData,
//     takenCourses = [],
//     plannedClasses = []
//   }) {
//     // Step 1: Filter out courses that are already taken or planned
//     const takenCodes = new Set(takenCourses.map(c => c.courseCode || c.code));
//     const plannedCodes = new Set(plannedClasses.map(c => c.code));
    
//     const availableClasses = allClasses.filter(cls => 
//       !takenCodes.has(cls.code) && 
//       !plannedCodes.has(cls.code) &&
//       cls.active
//     );
  
//     // Step 2: Identify needed courses from degree requirements
//     const neededCourses = identifyNeededCourses(degreeData, takenCourses, plannedClasses);
  
//     // Step 3: Score each available class
//     const scoredClasses = availableClasses.map(cls => ({
//       ...cls,
//       score: calculateCourseScore(cls, preferences, neededCourses)
//     }));
  
//     // Step 4: Sort by score and return top recommendations
//     return scoredClasses
//       .filter(cls => cls.score > 0) // Only return classes with positive scores
//       .sort((a, b) => b.score - a.score)
//       .slice(0, 20); // Top 20 recommendations
//   }
  
  /**
   * Identify which courses the student still needs based on degree requirements
   */
/**
 * Calculate a score for a course based on user preferences and needs
 */
function calculateCourseScore(cls, preferences, neededCourses, prerequisitesMap) {
  let score = 0;

  // Factor 1: Is this course needed for degree? (0-50 points)
  if (neededCourses.codes.has(cls.code)) {
    const priority = neededCourses.priorities[cls.code] || 1;
    score += 30 + (priority * 10); // 40-50 points for required, 30-40 for electives
  } else {
    // Not in degree requirements, but could be useful elective
    score += 10;
  }

  // Factor 2: Professor preferences (0-25 points)
  const profScore = calculateProfessorScore(cls, preferences);
  score += profScore;

  // Factor 3: Time slot preferences (0-20 points)
  const timeScore = calculateTimeScore(cls, preferences);
  score += timeScore;

  // Factor 4: Workload difficulty preference (0-15 points)
  const difficultyScore = calculateDifficultyScore(cls, preferences);
  score += difficultyScore;

  // Factor 5: Week pattern preference (0-10 points)
  const patternScore = calculatePatternScore(cls, preferences);
  score += patternScore;

  // Factor 6: RMP ratings bonus (-10 to +10 points)
  const ratingScore = calculateRatingScore(cls);
  score += ratingScore;

  return Math.round(score);
}
  
  /**
   * Score based on professor preferences
   */
  function calculateProfessorScore(cls, preferences) {
    const { avoidProfessors = [] } = preferences;
    
    if (!cls.professors || cls.professors.length === 0) {
      return 12; // Neutral score if no professor info
    }
  
    // Check if any professor should be avoided
    const hasAvoidedProf = cls.professors.some(prof =>
      avoidProfessors.some(avoided => 
        prof.toLowerCase().includes(avoided.toLowerCase()) ||
        avoided.toLowerCase().includes(prof.toLowerCase())
      )
    );
  
    if (hasAvoidedProf) {
      return -50; // Heavy penalty - effectively filters out
    }
  
    // Bonus for highly rated professors
    const avgRating = getAverageRating(cls);
    if (avgRating && avgRating.quality >= 4.0) {
      return 25; // Bonus for great professors
    } else if (avgRating && avgRating.quality >= 3.5) {
      return 20;
    }
  
    return 15; // Default score
  }
  
  /**
   * Score based on time preferences
   */
  function calculateTimeScore(cls, preferences) {
    const { blockedSlots = [] } = preferences;
    
    if (!cls.schedule || !cls.schedule.startTime) {
      return 10; // Neutral if no schedule info
    }
  
    const startHour = parseInt(cls.schedule.startTime.split(':')[0]);
    const endHour = parseInt(cls.schedule.endTime.split(':')[0]);
  
    // Check if class falls in blocked time slots
    const isBlocked = blockedSlots.some(slot => {
      switch (slot) {
        case 'early_morning': // 8:00-10:00
          return startHour >= 8 && startHour < 10;
        case 'late_morning': // 10:00-12:00
          return startHour >= 10 && startHour < 12;
        case 'lunch': // 12:00-14:00
          return startHour >= 12 && startHour < 14;
        case 'early_afternoon': // 14:00-16:00
          return startHour >= 14 && startHour < 16;
        case 'late_afternoon': // 16:00-18:00
          return startHour >= 16 && startHour < 18;
        case 'evening': // 18:00-20:00
          return startHour >= 18 && startHour < 20;
        default:
          return false;
      }
    });
  
    if (isBlocked) {
      return -40; // Heavy penalty for blocked times
    }
  
    // Bonus for preferred times (assuming most prefer mid-morning to early afternoon)
    if (startHour >= 10 && startHour <= 14) {
      return 20;
    } else if (startHour >= 9 && startHour <= 15) {
      return 15;
    }
  
    return 10;
  }
  
  /**
   * Score based on workload difficulty preference
   */
  function calculateDifficultyScore(cls, preferences) {
    const { workload = 'balanced' } = preferences;
    
    const avgRating = getAverageRating(cls);
    if (!avgRating || !avgRating.difficulty) {
      return 7; // Neutral if no difficulty data
    }
  
    const difficulty = avgRating.difficulty;
  
    switch (workload) {
      case 'challenging':
        // Prefer harder classes (difficulty > 3.5)
        if (difficulty >= 4.0) return 15;
        if (difficulty >= 3.5) return 12;
        if (difficulty >= 3.0) return 8;
        return 5;
        
      case 'easier':
        // Prefer easier classes (difficulty < 2.5)
        if (difficulty <= 2.0) return 15;
        if (difficulty <= 2.5) return 12;
        if (difficulty <= 3.0) return 8;
        return 5;
        
      case 'balanced':
      default:
        // Prefer moderate difficulty (2.5-3.5)
        if (difficulty >= 2.5 && difficulty <= 3.5) return 15;
        if (difficulty >= 2.0 && difficulty <= 4.0) return 10;
        return 7;
    }
  }
  
  /**
   * Score based on week pattern preference
   */
  function calculatePatternScore(cls, preferences) {
    const { weekPattern = 'balanced_days' } = preferences;
    
    if (!cls.schedule || !cls.schedule.days) {
      return 5; // Neutral if no schedule info
    }
  
    const days = cls.schedule.days;
    const hasMWF = days.some(d => ['Monday', 'Wednesday', 'Friday'].includes(d));
    const hasTR = days.some(d => ['Tuesday', 'Thursday'].includes(d));
  
    switch (weekPattern) {
      case 'heavier_mwf':
        if (hasMWF && !hasTR) return 10;
        if (hasMWF) return 7;
        return 3;
        
      case 'heavier_tr':
        if (hasTR && !hasMWF) return 10;
        if (hasTR) return 7;
        return 3;
        
      case 'balanced_days':
      default:
        // Slight preference for mixed or standard patterns
        if (hasMWF || hasTR) return 8;
        return 5;
    }
  }
  
  /**
   * Score based on RMP ratings
   */
  function calculateRatingScore(cls) {
    const avgRating = getAverageRating(cls);
    
    if (!avgRating || !avgRating.quality) {
      return 0; // No bonus/penalty if no data
    }
  
    const quality = avgRating.quality;
    
    // Quality-based scoring
    if (quality >= 4.5) return 10;
    if (quality >= 4.0) return 7;
    if (quality >= 3.5) return 4;
    if (quality >= 3.0) return 0;
    if (quality >= 2.5) return -3;
    return -7; // Below 2.5
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
   * Format recommendations for display with explanations
   */
  export function formatRecommendation(cls, neededCourses) {
    const reasons = [];
    
    // Why is this recommended?
    if (neededCourses.codes.has(cls.code)) {
      const priority = neededCourses.priorities[cls.code];
      if (priority === 3) {
        reasons.push('Required for your degree');
      } else if (priority === 2) {
        reasons.push('Fulfills a degree requirement');
      } else {
        reasons.push('Counts toward your degree');
      }
    }
  
    const avgRating = getAverageRating(cls);
    if (avgRating && avgRating.quality >= 4.0) {
      reasons.push(`Highly rated (${avgRating.quality.toFixed(1)}/5.0)`);
    }
  
    if (cls.schedule && cls.schedule.days) {
      reasons.push(`Meets ${cls.schedule.days.join('/')}`);
    }
  
    return {
      ...cls,
      recommendationReasons: reasons,
      matchScore: cls.score
    };
  }

  /**
 * Enhance recommendations with GPT insights
 * @param {Array} recommendations - Scored recommendations from generateRecommendations
 * @param {Object} context - Additional context (preferences, degree data, etc.)
 * @returns {Promise<Array>} GPT-enhanced recommendations
 */
/**
 * Enhance recommendations with GPT insights (using same approach as degree parser)
 */
// export async function enhanceWithGPT(recommendations, context) {
//   console.log('🤖 Starting GPT enhancement...');
//   console.log('Input recommendations:', recommendations.length);
  
//   const { preferences, degreeData, takenCourses, plannedClasses } = context;
  
//   // Get API key from environment (you'll need to pass this from backend or store it)
//   const apiKey = process.env.OPENAI_API_KEY;
//   if (!apiKey) {
//     console.warn('⚠️ No OpenAI API key found, skipping GPT enhancement');
//     return recommendations;
//   }
  
//   const topCourses = recommendations.slice(0, 10);
//   console.log('Sending top', topCourses.length, 'courses to GPT');
  
//   const prompt = `You are a course advisor. I have algorithmically scored these courses for a ${degreeData?.major || 'Computer Science'} student. Please re-rank the top 5-7 and add personalized insights.

// Student Preferences:
// - Avoided Professors: ${preferences.avoidProfessors.join(', ') || 'None'}
// - Blocked Time Slots: ${preferences.blockedSlots.join(', ') || 'None'}
// - Workload Preference: ${preferences.workload}
// - Week Pattern: ${preferences.weekPattern}

// Courses Taken: ${takenCourses?.map(c => c.courseCode || c.code).join(', ') || 'None'}
// Courses Planned: ${plannedClasses?.map(c => c.code).join(', ') || 'None'}

// Top Algorithmic Recommendations:
// ${topCourses.map((c, i) => {
//   const avgRating = getAverageRating(c);
//   return `${i + 1}. ${c.code} - ${c.name} (Algorithm Score: ${c.score})
//    - Professors: ${c.professors?.join(', ') || 'TBA'}
//    - Schedule: ${c.schedule ? `${c.schedule.days?.join('/')} ${c.schedule.startTime}-${c.schedule.endTime}` : 'TBA'}
//    - RMP Quality: ${avgRating?.quality?.toFixed(1) || 'N/A'} | Difficulty: ${avgRating?.difficulty?.toFixed(1) || 'N/A'}`;
// }).join('\n\n')}

// Return ONLY valid JSON (no markdown) with this structure:
// [
//   {
//     "courseCode": "CS 1101",
//     "rank": 1,
//     "confidence": "high",
//     "reasoning": "One sentence why this is a great fit",
//     "warning": "Any concerns or null"
//   }
// ]

// Select 5-7 courses based on: degree progress, workload balance, professor quality, schedule fit.`;

//   try {
//     const response = await fetch('https://api.openai.com/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${apiKey}`
//       },
//       body: JSON.stringify({
//         model: 'gpt-4o-mini',
//         messages: [
//           { 
//             role: 'system', 
//             content: 'You are an expert academic advisor. Provide concise, actionable course recommendations. Return only valid JSON.' 
//           },
//           { role: 'user', content: prompt }
//         ],
//         temperature: 0.7,
//         max_tokens: 1200
//       })
//     });

//     const data = await response.json();
    
//     if (data.error) {
//       console.error('OpenAI API error:', data.error.message);
//       return recommendations; // Fallback
//     }

//     if (!data.choices || !data.choices[0] || !data.choices[0].message) {
//       console.error('Unexpected API response structure');
//       return recommendations;
//     }

//     const parsedText = data.choices[0].message.content.trim();
//     console.log('Raw GPT response (first 200 chars):', parsedText.substring(0, 200));
    
//     const cleanedText = parsedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
//     let gptRankings;
//     try {
//       gptRankings = JSON.parse(cleanedText);
//     } catch (parseError) {
//       console.error('JSON Parse Error:', parseError.message);
//       return recommendations; // Fallback
//     }

//     // Merge GPT insights with original course data
//     const enhancedRecs = gptRankings.map(gptRec => {
//       const originalCourse = recommendations.find(c => c.code === gptRec.courseCode);
//       if (!originalCourse) return null;
      
//       return {
//         ...originalCourse,
//         gptRank: gptRec.rank,
//         gptConfidence: gptRec.confidence,
//         gptReasoning: gptRec.reasoning,
//         gptWarning: gptRec.warning,
//         isGPTEnhanced: true
//       };
//     }).filter(Boolean);

//     console.log(`✅ GPT enhanced ${enhancedRecs.length} recommendations`);
//     return enhancedRecs;

//   } catch (error) {
//     console.error('GPT enhancement failed:', error.message);
//     return recommendations; // Fallback to manual
//   }
// }

/**
 * Main function to generate course recommendations
 * @param {Object} preferences - User preferences from RecommendMe form
 * @param {Array} allClasses - All available classes from database
 * @param {Object} degreeData - Degree requirements data
 * @param {Array} takenCourses - Courses user has already taken
 * @param {Array} plannedClasses - Courses already in planner
 * @param {Object} prerequisitesMap - Map of courseCode -> prerequisite data
 * @returns {Array} Recommended courses sorted by score
 */
export function generateRecommendations({
  preferences,
  allClasses,
  degreeData,
  takenCourses = [],
  plannedClasses = [],
  prerequisitesMap = {}
}) {
  console.log('🎯 Starting recommendation generation...');
  console.log('🎯 Starting recommendation generation...');
console.log('📊 Input stats:', {
  totalClasses: allClasses.length,
  takenCourses: takenCourses.length,
  plannedClasses: plannedClasses.length,
  prerequisitesMap: Object.keys(prerequisitesMap).length
});

// Step 1: Filter out courses that are already taken or planned
const takenCodes = new Set(takenCourses.map(c => c.courseCode || c.code));
const plannedCodes = new Set(plannedClasses.map(c => c.code));

console.log('📝 Taken courses:', Array.from(takenCodes));
console.log('📅 Planned courses:', Array.from(plannedCodes));

// Step 1.5: Filter out courses where prerequisites aren't met
const completedCourses = new Set([...takenCodes, ...plannedCodes]);
console.log('✅ Completed courses total:', completedCourses.size);

let filteredByTaken = 0;
let filteredByPlanned = 0;
let filteredByActive = 0;
let filteredByPrereqs = 0;

const availableClasses = allClasses.filter(cls => {
  // Already taken or planned
  if (takenCodes.has(cls.code)) {
    filteredByTaken++;
    return false;
  }
  
  if (plannedCodes.has(cls.code)) {
    filteredByPlanned++;
    return false;
  }
  
  // // Not active
  // if (!cls.active) {
  //   filteredByActive++;
  //   return false;
  // }
  
  // Check prerequisites
  const prereqData = prerequisitesMap[cls.code];
  if (prereqData && prereqData.hasPrerequisites) {
    const meetsPrereqs = checkPrerequisites(prereqData, completedCourses);
    if (!meetsPrereqs) {
      console.log(`  ✗ ${cls.code} - Prerequisites not met`);
      filteredByPrereqs++;
      return false;
    }
  }
  
  return true;
});

console.log('🔍 Filtering results:', {
  filteredByTaken,
  filteredByPlanned,
  filteredByActive,
  filteredByPrereqs,
  remaining: availableClasses.length
});
  console.log('🔍 Filtering results:', {
    filteredByTaken,
    filteredByPlanned,
    filteredByActive,
    filteredByPrereqs,
    remaining: availableClasses.length
  });
  
  console.log(`✓ Available classes after filtering: ${availableClasses.length}`);
  
  // Show a sample of what's left
  if (availableClasses.length > 0) {
    console.log('Sample available courses:', availableClasses.slice(0, 5).map(c => c.code));
  } else {
    console.warn('⚠️ NO CLASSES AVAILABLE! Check the filtering logic above.');
  }

  // Step 2: Identify needed courses from degree requirements
  const neededCourses = identifyNeededCourses(degreeData, takenCourses, plannedClasses);

  // Step 3: Score each available class
  const scoredClasses = availableClasses.map(cls => ({
    ...cls,
    score: calculateCourseScore(cls, preferences, neededCourses, prerequisitesMap),
    prerequisiteInfo: prerequisitesMap[cls.code] || { hasPrerequisites: false }
  }));

  // Step 4: Sort by score and return top recommendations
  return scoredClasses
    .filter(cls => cls.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/**
 * Check if a student has met the prerequisites for a course
 */
function checkPrerequisites(prereqData, completedCourses) {
  if (!prereqData.hasPrerequisites || !prereqData.prerequisiteCourses || prereqData.prerequisiteCourses.length === 0) {
    return true;
  }
  
  const { prerequisiteType, prerequisiteCourses } = prereqData;
  
  switch (prerequisiteType) {
    case 'none':
      return true;
      
    case 'or':
      // Student needs at least ONE of the prerequisites
      return prerequisiteCourses.some(prereq => 
        completedCourses.has(prereq)
      );
      
    case 'and':
    case 'single':
    default:
      // Student needs ALL prerequisites
      return prerequisiteCourses.every(prereq => 
        completedCourses.has(prereq)
      );
  }
}

// Keep all your other existing functions (identifyNeededCourses, calculateCourseScore, etc.)
export async function enhanceWithGPT(recommendations, context) {
  console.log('🤖 Starting GPT enhancement...');
  console.log('Input recommendations:', recommendations.length);
  
  // If no recommendations, skip GPT
  if (!recommendations || recommendations.length === 0) {
    console.log('⚠️ No recommendations to enhance');
    return recommendations;
  }
  
  const { preferences, degreeData, takenCourses, plannedClasses } = context;
  
  // Get API key from Vite env variable
  const apiKey = import.meta.env.OPENAI_API_KEY;
  
  console.log('API key check:', apiKey ? `✓ Found` : '✗ Missing');
  
  if (!apiKey || apiKey === 'sk-your-actual-key-here' || apiKey.length < 20) {
    console.warn('⚠️ No valid OpenAI API key found, returning basic recommendations');
    return recommendations;
  }
  
  const topCourses = recommendations.slice(0, 10);
  console.log('Sending top', topCourses.length, 'courses to GPT');
  console.log('Course codes:', topCourses.map(c => c.code).join(', '));
  
  const prompt = `You are a course advisor. Re-rank these ${topCourses.length} courses for a ${degreeData?.major || 'Computer Science'} student.

Student Preferences:
- Workload: ${preferences.workload}
- Week Pattern: ${preferences.weekPattern}
- Avoiding Professors: ${preferences.avoidProfessors?.join(', ') || 'None'}
- Blocked Time Slots: ${preferences.blockedSlots?.join(', ') || 'None'}

Top Courses (by algorithm score):
${topCourses.map((c, i) => {
  const professors = c.professors?.join(', ') || 'TBA';
  const schedule = c.schedule ? `${c.schedule.days?.join('/')} ${c.schedule.startTime}-${c.schedule.endTime}` : 'TBA';
  return `${i + 1}. ${c.code} - ${c.name}
   Score: ${c.score} | Professors: ${professors} | Schedule: ${schedule}`;
}).join('\n\n')}

IMPORTANT: You must return ALL ${topCourses.length} courses using their EXACT course codes above.

Return a JSON array with this exact format:
[
  {
    "courseCode": "exact code from above",
    "rank": 1,
    "confidence": "high",
    "reasoning": "Brief reason why this is ranked here",
    "warning": null
  }
]`;

  console.log('Making API call to OpenAI...');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

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
            content: 'You are an academic advisor. Return ONLY a valid JSON array using the EXACT course codes provided. No other text.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,  // Lower temperature for more accurate course codes
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('✓ Got response, status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      console.log('⚠️ Falling back to basic recommendations');
      return recommendations;
    }

    const data = await response.json();
    console.log('✓ Parsed JSON response');
    
    if (data.error) {
      console.error('OpenAI API error:', data.error.message);
      return recommendations;
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected API response structure:', data);
      return recommendations;
    }

    const parsedText = data.choices[0].message.content.trim();
    console.log('✓ Got content, length:', parsedText.length);
    
    const cleanedText = parsedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let gptRankings;
    try {
      gptRankings = JSON.parse(cleanedText);
      console.log('✓ Parsed GPT rankings:', gptRankings.length);
      console.log('GPT returned codes:', gptRankings.map(r => r.courseCode).join(', '));
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.log('Failed to parse:', cleanedText);
      return recommendations;
    }

    if (!Array.isArray(gptRankings) || gptRankings.length === 0) {
      console.warn('⚠️ GPT returned invalid or empty array');
      return recommendations;
    }

    const enhancedRecs = gptRankings.map(gptRec => {
      const originalCourse = recommendations.find(c => 
        c.code.toUpperCase() === gptRec.courseCode.toUpperCase()
      );
      
      if (!originalCourse) {
        console.warn('Could not find course:', gptRec.courseCode);
        return null;
      }
      
      return {
        ...originalCourse,
        gptRank: gptRec.rank,
        gptConfidence: gptRec.confidence,
        gptReasoning: gptRec.reasoning,
        gptWarning: gptRec.warning,
        isGPTEnhanced: true
      };
    }).filter(Boolean);

    console.log(`✅ GPT enhanced ${enhancedRecs.length} recommendations`);
    
    if (enhancedRecs.length === 0) {
      console.warn('⚠️ No courses matched, returning original recommendations');
      return recommendations;
    }
    
    return enhancedRecs;

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('⏱️ GPT request timed out after 60 seconds');
    } else {
      console.error('❌ GPT enhancement failed:', error.message);
    }
    return recommendations;
  }
}

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
    priorities: {} // Store priority levels for each course
  };

  degreeData.categories.forEach(category => {
    const categoryNeeds = {
      name: category.name,
      requiredHours: category.requiredHours,
      minCourses: category.minCourses,
      earnedHours: 0,
      availableCourses: []
    };

    // Calculate earned hours in this category
    category.availableClasses.forEach(cls => {
      if (completedSet.has(cls.code)) {
        categoryNeeds.earnedHours += cls.hours || 3;
      }
    });

    // Identify still-needed courses
    if (categoryNeeds.earnedHours < category.requiredHours) {
      category.availableClasses.forEach(cls => {
        if (!completedSet.has(cls.code)) {
          needed.codes.add(cls.code);
          categoryNeeds.availableCourses.push(cls.code);
          
          // Set priority: required courses are highest priority
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
