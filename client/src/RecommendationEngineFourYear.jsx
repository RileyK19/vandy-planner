// NOT IN USE 

/**
 * Four-Year Course Planning Engine
 * Generates a complete 4-year plan with GPT-enhanced recommendations
 * Self-contained - does not depend on single-semester recommendation engine
 */

/**
 * Generate a complete 4-year plan
 * @param {Object} params - All planning parameters
 * @returns {Promise<Object>} 4-year plan with courses organized by semester
 */
export async function generateFourYearPlan({
  preferences,
  allClasses,
  degreeData,
  takenCourses = [],
  plannedClasses = [],
  prerequisitesMap = {},
  currentYear = 'Freshman',
  startSemester = 'Fall',
  startYear = 2025
}) {
  console.log('🎓 Starting 4-year plan generation...');
  console.log('📊 Planning for:', currentYear, 'starting', startSemester, startYear);

  // Calculate remaining semesters
  const yearsRemaining = {
    'Freshman': 4,
    'Sophomore': 3,
    'Junior': 2,
    'Senior': 1
  }[currentYear] || 4;

  const totalSemesters = startSemester === 'Fall' ? yearsRemaining * 2 : (yearsRemaining * 2) - 1;
  console.log(`📅 Planning for ${totalSemesters} semesters`);

  // Generate semester schedule
  const semesters = generateSemesterSchedule(startSemester, startYear, totalSemesters);

  // Target credits per semester
  const creditsPerSemester = {
    'challenging': 17,
    'balanced': 15,
    'easier': 13
  }[preferences.workload] || 15;

  // Filter available courses
  const takenCodes = new Set(takenCourses.map(c => c.courseCode || c.code));
  const plannedCodes = new Set(plannedClasses.map(c => c.code));
  const completedCourses = new Set([...takenCodes, ...plannedCodes]);

  // Get needed courses from degree requirements
  const neededCourses = identifyNeededCourses(degreeData, takenCourses, plannedClasses);

  // Filter and score all available courses
  const availableClasses = allClasses.filter(cls => {
    if (takenCodes.has(cls.code) || plannedCodes.has(cls.code)) {
      return false;
    }
    return true;
  });

  // Score each course
  const scoredCourses = availableClasses.map(cls => ({
    ...cls,
    score: calculateCourseScore(cls, preferences, neededCourses),
    prerequisiteInfo: prerequisitesMap[cls.code] || { hasPrerequisites: false }
  })).filter(cls => cls.score > 0);

  console.log(`✅ Scored ${scoredCourses.length} available courses`);

  // Distribute courses across semesters
  const semesterPlan = distributeCoursesBySemester(
    scoredCourses,
    semesters,
    creditsPerSemester,
    prerequisitesMap,
    completedCourses
  );

  // Enhance with GPT
  const gptEnhancedPlan = await enhancePlanWithGPT(
    semesterPlan,
    {
      preferences,
      degreeData,
      takenCourses,
      plannedClasses,
      currentYear,
      creditsPerSemester
    }
  );

  return gptEnhancedPlan;
}

/**
 * Generate semester labels
 */
function generateSemesterSchedule(startSemester, startYear, totalSemesters) {
  const semesters = [];
  let currentTerm = startSemester;
  let currentYear = startYear;

  for (let i = 0; i < totalSemesters; i++) {
    const yearLabel = getYearLabel(i, startSemester);
    
    semesters.push({
      name: `${currentTerm} ${currentYear}`,
      term: currentTerm,
      year: currentYear,
      yearLabel,
      index: i
    });

    if (currentTerm === 'Fall') {
      currentTerm = 'Spring';
      currentYear++;
    } else {
      currentTerm = 'Fall';
    }
  }

  return semesters;
}

/**
 * Get academic year label
 */
function getYearLabel(semesterIndex, startSemester) {
  const academicYears = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
  const yearIndex = Math.floor(semesterIndex / 2);
  const term = (startSemester === 'Fall' && semesterIndex % 2 === 0) || 
                (startSemester === 'Spring' && semesterIndex % 2 === 1) 
                ? 'Fall' : 'Spring';
  
  return `${academicYears[yearIndex] || 'Senior'} ${term}`;
}

/**
 * Identify needed courses from degree requirements
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
          needed.priorities[cls.code] = cls.required ? 3 : (category.minCourses ? 2 : 1);
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
 * Calculate course score
 */
function calculateCourseScore(cls, preferences, neededCourses) {
  let score = 0;

  // Degree requirement (0-50 points)
  if (neededCourses.codes.has(cls.code)) {
    const priority = neededCourses.priorities[cls.code] || 1;
    score += 30 + (priority * 10);
  } else {
    score += 10;
  }

  // Professor preferences (0-30 points)
  const profScore = calculateProfessorScore(cls, preferences);
  score += profScore;

  // Time slot preferences (0-25 points)
  const timeScore = calculateTimeScore(cls, preferences);
  score += timeScore;

  // Workload difficulty (0-15 points)
  const difficultyScore = calculateDifficultyScore(cls, preferences);
  score += difficultyScore;

  // Week pattern (0-10 points)
  const patternScore = calculatePatternScore(cls, preferences);
  score += patternScore;

  // RMP ratings (-15 to +20 points)
  const ratingScore = calculateRatingScore(cls);
  score += ratingScore;

  return Math.round(score);
}

function calculateProfessorScore(cls, preferences) {
  const { avoidProfessors = [] } = preferences;
  
  if (!cls.professors || cls.professors.length === 0) {
    return 15;
  }

  const hasAvoidedProf = cls.professors.some(prof =>
    avoidProfessors.some(avoided => 
      prof.toLowerCase().includes(avoided.toLowerCase()) ||
      avoided.toLowerCase().includes(prof.toLowerCase())
    )
  );

  if (hasAvoidedProf) {
    return -50;
  }

  const avgRating = getAverageRating(cls);
  if (avgRating && avgRating.quality) {
    const quality = avgRating.quality;
    const profBonus = Math.max(5, Math.min(30, (quality - 2.0) * (25 / 3) + 5));
    return Math.round(profBonus);
  }

  return 15;
}

function calculateTimeScore(cls, preferences) {
  const { blockedSlots = [] } = preferences;
  
  if (!cls.schedule || !cls.schedule.startTime) {
    return 12;
  }

  const startHour = parseInt(cls.schedule.startTime.split(':')[0]);

  const isBlocked = blockedSlots.some(slot => {
    switch (slot) {
      case 'early_morning': return startHour >= 8 && startHour < 10;
      case 'late_morning': return startHour >= 10 && startHour < 12;
      case 'lunch': return startHour >= 12 && startHour < 14;
      case 'early_afternoon': return startHour >= 14 && startHour < 16;
      case 'late_afternoon': return startHour >= 16 && startHour < 18;
      case 'evening': return startHour >= 18 && startHour < 20;
      default: return false;
    }
  });

  if (isBlocked) {
    return -40;
  }

  let score = 12;
  if (startHour >= 9 && startHour < 14) {
    if (startHour === 11 || startHour === 12) {
      score = 25;
    } else if (startHour === 10 || startHour === 13) {
      score = 23;
    } else if (startHour === 9) {
      score = 20;
    } else {
      score = 18;
    }
  } else if (startHour >= 8 && startHour < 15) {
    score = 15;
  }

  return score;
}

function calculateDifficultyScore(cls, preferences) {
  const { workload = 'balanced' } = preferences;
  
  const avgRating = getAverageRating(cls);
  if (!avgRating || !avgRating.difficulty) {
    return 8;
  }

  const difficulty = avgRating.difficulty;

  switch (workload) {
    case 'challenging':
      const hardScore = Math.max(5, Math.min(15, (difficulty - 2.0) * (10 / 2.5) + 5));
      return Math.round(hardScore);
    case 'easier':
      const easyScore = Math.max(5, Math.min(15, -1.5 * difficulty + 16.5));
      return Math.round(easyScore);
    case 'balanced':
    default:
      const distanceFromIdeal = Math.abs(difficulty - 3.0);
      const balancedScore = Math.max(5, Math.min(15, 15 - (distanceFromIdeal * 3)));
      return Math.round(balancedScore);
  }
}

function calculatePatternScore(cls, preferences) {
  const { weekPattern = 'balanced_days' } = preferences;
  
  if (!cls.schedule || !cls.schedule.days) {
    return 5;
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
      if (hasMWF || hasTR) return 8;
      return 5;
  }
}

function calculateRatingScore(cls) {
  const avgRating = getAverageRating(cls);
  
  if (!avgRating || !avgRating.quality) {
    return 0;
  }

  const quality = avgRating.quality;
  const ratingScore = Math.max(-15, Math.min(20, (quality - 1.0) * (35 / 4) - 15));
  return Math.round(ratingScore);
}

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
 * Distribute courses across semesters
 */
function distributeCoursesBySemester(
  scoredCourses,
  semesters,
  targetCreditsPerSemester,
  prerequisitesMap,
  completedCourses
) {
  const semesterPlan = {
    semesters: [],
    totalCredits: 0,
    totalCourses: 0
  };

  const assignedCourses = new Set();

  for (const semester of semesters) {
    const semesterCourses = [];
    let semesterCredits = 0;

    const availableForSemester = scoredCourses.filter(course => {
      if (assignedCourses.has(course.code) || completedCourses.has(course.code)) {
        return false;
      }

      const prereqData = prerequisitesMap[course.code];
      if (prereqData?.hasPrerequisites) {
        const allCompleted = new Set([...completedCourses, ...assignedCourses]);
        const meetsPrereqs = checkPrerequisites(prereqData, allCompleted);
        if (!meetsPrereqs) {
          return false;
        }
      }

      return true;
    });

    availableForSemester.sort((a, b) => b.score - a.score);

    for (const course of availableForSemester) {
      const courseCredits = course.hours || 3;
      
      if (semesterCredits + courseCredits > targetCreditsPerSemester + 1) {
        continue;
      }

      semesterCourses.push(course);
      semesterCredits += courseCredits;
      assignedCourses.add(course.code);

      if (semesterCredits >= targetCreditsPerSemester) {
        break;
      }
    }

    semesterPlan.semesters.push({
      ...semester,
      courses: semesterCourses,
      credits: semesterCredits
    });

    semesterPlan.totalCredits += semesterCredits;
    semesterPlan.totalCourses += semesterCourses.length;
  }

  return semesterPlan;
}

/**
 * Check prerequisites
 */
function checkPrerequisites(prereqData, completedCourses) {
  if (!prereqData.hasPrerequisites || !prereqData.prerequisiteCourses || 
      prereqData.prerequisiteCourses.length === 0) {
    return true;
  }
  
  const { prerequisiteType, prerequisiteCourses } = prereqData;
  
  switch (prerequisiteType) {
    case 'none':
      return true;
    case 'or':
      return prerequisiteCourses.some(prereq => completedCourses.has(prereq));
    case 'and':
    case 'single':
    default:
      return prerequisiteCourses.every(prereq => completedCourses.has(prereq));
  }
}

/**
 * Enhance plan with GPT analysis
 */
async function enhancePlanWithGPT(semesterPlan, context) {
  console.log('🤖 Enhancing 4-year plan with GPT...');

  const { preferences, degreeData, takenCourses, currentYear, creditsPerSemester } = context;

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'sk-your-actual-key-here' || apiKey.length < 20) {
    console.warn('⚠️ No valid OpenAI API key, returning plan without GPT enhancement');
    return semesterPlan;
  }

  const semesterSummary = semesterPlan.semesters.map((sem, idx) => {
    const courses = sem.courses.map(c => 
      `${c.code} (${c.hours || 3} credits) - ${c.name}`
    ).join(', ');
    
    return `${idx + 1}. ${sem.name} (${sem.yearLabel}): ${sem.credits} credits
   Courses: ${courses || 'None scheduled'}`;
  }).join('\n\n');

  const prompt = `You are an academic advisor reviewing a 4-year course plan for a ${currentYear} ${degreeData?.major || 'Computer Science'} student.

**Student Profile:**
- Current Year: ${currentYear}
- Target Credits/Semester: ${creditsPerSemester}
- Workload Preference: ${preferences.workload}
- Week Pattern: ${preferences.weekPattern}
- Courses Already Taken: ${takenCourses.length}

**Proposed 4-Year Plan:**
${semesterSummary}

**Total:** ${semesterPlan.totalCourses} courses, ${semesterPlan.totalCredits} credits over ${semesterPlan.semesters.length} semesters

Return ONLY a valid JSON object (no markdown) with this structure:
{
  "overallAssessment": "Brief assessment (2-3 sentences)",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2"],
  "semesterInsights": [
    {
      "semesterIndex": 0,
      "assessment": "Brief assessment",
      "recommendation": "Suggestion or null",
      "warning": "Warning or null"
    }
  ]
}

Focus on: graduation timeline, credit balance, course sequencing, prerequisites, workload sustainability.`;

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
            content: 'You are an expert academic advisor. Return ONLY valid JSON with no markdown.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('⚠️ GPT API error, returning plan without enhancement');
      return semesterPlan;
    }

    const data = await response.json();
    const gptText = data.choices?.[0]?.message?.content?.trim();
    
    if (!gptText) {
      console.warn('⚠️ No GPT response, returning plan without enhancement');
      return semesterPlan;
    }

    const cleanedText = gptText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const gptAnalysis = JSON.parse(cleanedText);

    const enhancedSemesters = semesterPlan.semesters.map((sem, idx) => {
      const insight = gptAnalysis.semesterInsights?.find(s => s.semesterIndex === idx);
      return {
        ...sem,
        gptInsight: insight || null
      };
    });

    console.log('✅ Successfully enhanced plan with GPT');

    return {
      ...semesterPlan,
      semesters: enhancedSemesters,
      gptAnalysis: {
        overallAssessment: gptAnalysis.overallAssessment,
        strengths: gptAnalysis.strengths || [],
        concerns: gptAnalysis.concerns || []
      }
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('⏱️ GPT request timed out');
    } else {
      console.error('❌ GPT enhancement failed:', error.message);
    }
    return semesterPlan;
  }
}

export default generateFourYearPlan;