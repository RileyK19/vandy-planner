/**
 * Four-Year Plan Recommendation Engine
 * Generates an 8-semester course plan that respects prerequisites and balances workload
 */

/**
 * Main function to generate a 4-year plan
 * @param {Object} preferences - User preferences from form
 * @param {Array} allClasses - All available classes
 * @param {Object} degreeData - Degree requirements
 * @param {Array} takenCourses - Already completed courses
 * @param {Array} plannedClasses - Courses in current planner
 * @param {Object} prerequisitesMap - Prerequisites mapping
 * @returns {Object} { semesters: [...], totalCredits: number }
 */
export function generateFourYearPlan({
    preferences,
    allClasses,
    degreeData,
    takenCourses = [],
    plannedClasses = [],
    prerequisitesMap = {}
  }) {
    console.log('🎓 Starting 4-year plan generation...');
    
    // Initialize 8 semesters
    const semesters = Array.from({ length: 8 }, (_, i) => ({
      name: getSemesterName(i),
      number: i + 1,
      courses: [],
      credits: 0,
      year: Math.floor(i / 2) + 1,
      term: i % 2 === 0 ? 'Fall' : 'Spring'
    }));
  
    // Track completed courses (taken + planned)
    const completedCourses = new Set([
      ...takenCourses.map(c => c.courseCode || c.code),
      ...plannedClasses.map(c => c.code)
    ]);
  
    // Filter available classes
    const availableClasses = allClasses.filter(cls => 
      !completedCourses.has(cls.code)
    );
  
    console.log(`📚 Available courses for planning: ${availableClasses.length}`);
  
    // Identify required courses by category
    const coursesByCategory = categorizeCourses(degreeData, availableClasses, completedCourses);
    
    // Build prerequisite graph
    const prereqGraph = buildPrerequisiteGraph(availableClasses, prerequisitesMap);
    
    // Determine course priorities
    const prioritizedCourses = prioritizeCourses(
      availableClasses, 
      coursesByCategory, 
      prereqGraph,
      prerequisitesMap
    );
  
    // Distribute courses across semesters
    distributeCourses(
      semesters,
      prioritizedCourses,
      preferences,
      prereqGraph,
      prerequisitesMap,
      completedCourses
    );
  
    // Calculate total credits
    const totalCredits = semesters.reduce((sum, sem) => sum + sem.credits, 0);
  
    console.log(`✅ Generated 4-year plan with ${totalCredits} credits`);
    
    return {
      semesters,
      totalCredits,
      summary: generatePlanSummary(semesters, degreeData)
    };
  }
  
  /**
   * Get semester name (e.g., "Fall 2025", "Spring 2026")
   */
  function getSemesterName(index) {
    const startYear = new Date().getFullYear();
    const startMonth = new Date().getMonth();
    
    // If we're past August, start with next year's Spring
    const firstSemester = startMonth >= 8 ? 'Spring' : 'Fall';
    const firstYear = startMonth >= 8 ? startYear + 1 : startYear;
    
    const year = firstYear + Math.floor(index / 2);
    const term = (firstSemester === 'Fall' && index % 2 === 0) || 
                  (firstSemester === 'Spring' && index % 2 === 1) 
                  ? 'Fall' : 'Spring';
    
    return `${term} ${year}`;
  }
  
  /**
   * Categorize courses by degree requirements
   */
  function categorizeCourses(degreeData, availableClasses, completedCourses) {
    const categories = {
      required: [],
      coreCourses: [],
      electives: [],
      other: []
    };
  
    if (!degreeData || !degreeData.categories) {
      return categories;
    }
  
    const availableCodes = new Set(availableClasses.map(c => c.code));
  
    degreeData.categories.forEach(category => {
      category.availableClasses.forEach(cls => {
        if (!availableCodes.has(cls.code) || completedCourses.has(cls.code)) {
          return;
        }
  
        const courseData = availableClasses.find(c => c.code === cls.code);
        if (!courseData) return;
  
        if (cls.required) {
          categories.required.push(courseData);
        } else if (category.name.toLowerCase().includes('core')) {
          categories.coreCourses.push(courseData);
        } else {
          categories.electives.push(courseData);
        }
      });
    });
  
    // Remaining courses are "other"
    availableClasses.forEach(cls => {
      const alreadyCategorized = 
        categories.required.some(c => c.code === cls.code) ||
        categories.coreCourses.some(c => c.code === cls.code) ||
        categories.electives.some(c => c.code === cls.code);
      
      if (!alreadyCategorized) {
        categories.other.push(cls);
      }
    });
  
    // Remove duplicates from each category
    categories.required = deduplicateCourses(categories.required);
    categories.coreCourses = deduplicateCourses(categories.coreCourses);
    categories.electives = deduplicateCourses(categories.electives);
    categories.other = deduplicateCourses(categories.other);
  
    console.log('📂 Course categories:', {
      required: categories.required.length,
      core: categories.coreCourses.length,
      electives: categories.electives.length,
      other: categories.other.length
    });
  
    return categories;
  }
  
  /**
   * Remove duplicate course codes, keeping only first occurrence
   */
  function deduplicateCourses(courses) {
    const seen = new Set();
    return courses.filter(course => {
      if (seen.has(course.code)) {
        return false;
      }
      seen.add(course.code);
      return true;
    });
  }
  
  /**
   * Build prerequisite dependency graph
   */
  function buildPrerequisiteGraph(courses, prerequisitesMap) {
    const graph = {};
  
    courses.forEach(course => {
      const prereqData = prerequisitesMap[course.code];
      graph[course.code] = {
        prerequisites: prereqData?.prerequisiteCourses || [],
        prerequisiteType: prereqData?.prerequisiteType || 'none',
        dependents: [] // Courses that depend on this one
      };
    });
  
    // Build reverse dependencies
    courses.forEach(course => {
      const prereqs = graph[course.code]?.prerequisites || [];
      prereqs.forEach(prereq => {
        if (graph[prereq]) {
          graph[prereq].dependents.push(course.code);
        }
      });
    });
  
    return graph;
  }
  
  /**
   * Prioritize courses for scheduling
   * Priority order:
   * 1. Required courses with many dependents (foundational)
   * 2. Required courses
   * 3. Core courses with dependents
   * 4. Core courses
   * 5. Electives
   */
  function prioritizeCourses(availableClasses, coursesByCategory, prereqGraph, prerequisitesMap) {
    const prioritized = [];
  
    // Helper to calculate priority score
    function getPriorityScore(course) {
      let score = 0;
      
      // Category priority
      if (coursesByCategory.required.some(c => c.code === course.code)) {
        score += 1000;
      } else if (coursesByCategory.coreCourses.some(c => c.code === course.code)) {
        score += 500;
      } else if (coursesByCategory.electives.some(c => c.code === course.code)) {
        score += 100;
      }
  
      // Number of dependents (foundational courses)
      const dependents = prereqGraph[course.code]?.dependents || [];
      score += dependents.length * 50;
  
      // Course level (lower level courses first)
      const courseNumber = parseInt(course.code.match(/\d+/)?.[0] || '999');
      score += (1000 - courseNumber); // Earlier courses get higher score
  
      // Prefer courses with no prerequisites
      const hasPrereqs = prerequisitesMap[course.code]?.hasPrerequisites;
      if (!hasPrereqs) {
        score += 200;
      }
  
      return score;
    }
  
    // Sort by priority score
    const sorted = [...availableClasses].sort((a, b) => 
      getPriorityScore(b) - getPriorityScore(a)
    );
  
    return sorted.map(course => ({
      ...course,
      priorityScore: getPriorityScore(course)
    }));
  }
  
  /**
   * Distribute courses across semesters
   */
  function distributeCourses(
    semesters,
    prioritizedCourses,
    preferences,
    prereqGraph,
    prerequisitesMap,
    initiallyCompleted
  ) {
    const { workload = 'balanced' } = preferences;
    
    // Target credits per semester based on workload
    const targetCredits = {
      challenging: 17,
      balanced: 15,
      easier: 13
    }[workload] || 15;
  
    const minCredits = targetCredits - 3;
    const maxCredits = targetCredits + 3;
  
    // Track what's been scheduled and completed
    const scheduled = new Set();
    const completed = new Set(initiallyCompleted);
  
    // Schedule courses semester by semester
    semesters.forEach((semester, semIndex) => {
      console.log(`\n📅 Planning ${semester.name}...`);
      
      // Find courses that can be taken this semester
      const availableThisSemester = prioritizedCourses.filter(course => {
        // Already scheduled or completed
        if (scheduled.has(course.code) || completed.has(course.code)) {
          return false;
        }
  
        // Check if prerequisites are met
        const canTake = canTakeCourse(course.code, completed, prerequisitesMap);
        if (!canTake) {
          return false;
        }
  
        // Check user preferences (time, professors, etc.)
        if (!matchesPreferences(course, preferences)) {
          return false;
        }
  
        return true;
      });
  
      // Add courses until we hit target credits
      let semesterCredits = 0;
      const semesterCourses = [];
  
      for (const course of availableThisSemester) {
        const courseCredits = course.hours || 3;
        
        // Don't exceed max credits
        if (semesterCredits + courseCredits > maxCredits) {
          continue;
        }
  
        // Add course
        semesterCourses.push(course);
        semesterCredits += courseCredits;
        scheduled.add(course.code);
        completed.add(course.code); // Now available as prerequisite
  
        // Stop if we've hit target
        if (semesterCredits >= minCredits) {
          break;
        }
      }
  
      semester.courses = semesterCourses;
      semester.credits = semesterCredits;
  
      console.log(`  ✓ Added ${semesterCourses.length} courses (${semesterCredits} credits)`);
    });
  
    // Log any unscheduled required courses
    const unscheduled = prioritizedCourses.filter(c => !scheduled.has(c.code));
    if (unscheduled.length > 0) {
      console.warn(`⚠️ Could not schedule ${unscheduled.length} courses`);
    }
  }
  
  /**
   * Check if a course can be taken given completed courses
   */
  function canTakeCourse(courseCode, completedCourses, prerequisitesMap) {
    const prereqData = prerequisitesMap[courseCode];
    
    if (!prereqData || !prereqData.hasPrerequisites) {
      return true;
    }
  
    const { prerequisiteType, prerequisiteCourses } = prereqData;
  
    switch (prerequisiteType) {
      case 'none':
        return true;
      
      case 'or':
        // Need at least one prerequisite
        return prerequisiteCourses.some(prereq => completedCourses.has(prereq));
      
      case 'and':
      case 'single':
      default:
        // Need all prerequisites
        return prerequisiteCourses.every(prereq => completedCourses.has(prereq));
    }
  }
  
  /**
   * Check if course matches user preferences
   */
  function matchesPreferences(course, preferences) {
    const { avoidProfessors = [], blockedSlots = [] } = preferences;
  
    // Check professors
    if (course.professors && course.professors.length > 0) {
      const hasAvoidedProf = course.professors.some(prof =>
        avoidProfessors.some(avoided => 
          prof.toLowerCase().includes(avoided.toLowerCase())
        )
      );
      if (hasAvoidedProf) {
        return false;
      }
    }
  
    // Check time slots
    if (course.schedule && course.schedule.startTime && blockedSlots.length > 0) {
      const startHour = parseInt(course.schedule.startTime.split(':')[0]);
      
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
        return false;
      }
    }
  
    return true;
  }
  
  /**
   * Generate plan summary
   */
  function generatePlanSummary(semesters, degreeData) {
    const summary = {
      totalCourses: 0,
      totalCredits: 0,
      bySemester: [],
      categoryProgress: {}
    };
  
    semesters.forEach(sem => {
      summary.totalCourses += sem.courses.length;
      summary.totalCredits += sem.credits;
      summary.bySemester.push({
        name: sem.name,
        courses: sem.courses.length,
        credits: sem.credits
      });
    });
  
    return summary;
  }
  
  /**
   * Export for API integration
   */
  export async function getFourYearPlanRecommendations(payload, major, userEmail, plannedClasses) {
    // This would be called by your API
    // You'll need to fetch the necessary data (allClasses, degreeData, etc.)
    
    console.log('🔄 Fetching data for 4-year plan...');
    
    // Placeholder - replace with actual data fetching
    const mockData = {
      allClasses: [],
      degreeData: {},
      takenCourses: [],
      prerequisitesMap: {}
    };
  
    const plan = generateFourYearPlan({
      preferences: payload,
      ...mockData,
      plannedClasses
    });
  
    return plan;
  }