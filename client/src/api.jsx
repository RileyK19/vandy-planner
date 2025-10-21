// api.jsx - Fixed with direct URLs (like your working version)
// import { generateRecommendations } from './RecommendationEngine.jsx';
import { generateRecommendations, enhanceWithGPT } from './RecommendationEngine.jsx'
import { generateFourYearPlan } from './RecommendationEngineFourYear.jsx'

const API_BASE_URL = 'http://localhost:3001/api';

// Helper function to parse schedule strings from database
function parseSchedule(scheduleStr) {
  if (!scheduleStr || typeof scheduleStr !== 'string') return null;
  
  const parts = scheduleStr.split(';');
  if (parts.length !== 2) return null;
  
  const [daysStr, timeStr] = parts;
  const [startTime, endTime] = timeStr.split('-');
  
  // Convert day abbreviations to full names
  const dayMap = {
    'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 
    'R': 'Thursday', 'F': 'Friday', 'S': 'Saturday', 'U': 'Sunday'
  };
  
  const days = daysStr.split('').map(d => dayMap[d]).filter(Boolean);
  
  // Convert time format (11:15a -> 11:15, 1:15p -> 13:15)
  const convertTime = (time) => {
    if (!time) return '';
    const isPM = time.includes('p');
    const isAM = time.includes('a');
    const timeOnly = time.replace(/[ap]$/, '');
    
    const [hour, minute] = timeOnly.split(':');
    let convertedHour = parseInt(hour);
    
    if (isPM && convertedHour !== 12) {
      convertedHour += 12;
    } else if (isAM && convertedHour === 12) {
      convertedHour = 0;
    }
    
    return `${convertedHour.toString().padStart(2, '0')}:${minute}`;
  };
  
  return {
    days,
    startTime: convertTime(startTime),
    endTime: convertTime(endTime),
    location: 'TBA'
  };
}

// Helper function to normalize instructor names for RMP lookup
function normalizeInstructorName(name) {
  if (!name || typeof name !== 'string') return '';
  
  name = name.trim();
  
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const lastName = parts[0];
      const firstName = parts[1].split(' ')[0];
      return `${firstName} ${lastName}`;
    }
  }
  
  return name;
}

function extractInstructorNames(instructors) {
  if (!instructors) return [];
  
  if (Array.isArray(instructors)) {
    return instructors.map(instructor => {
      if (typeof instructor === 'string') {
        return normalizeInstructorName(instructor);
      } else if (instructor && instructor.name) {
        return normalizeInstructorName(instructor.name);
      }
      return '';
    }).filter(name => name.length > 0);
  }
  
  if (typeof instructors === 'string') {
    return [normalizeInstructorName(instructors)];
  }
  
  return [];
}

// API functions to fetch data from your backend
export async function fetchClassesFromDB() {
  try {
    // Use direct URL like your working version
    const response = await fetch('/api/classes');
    
    if (!response.ok) {
      throw new Error('Failed to fetch classes from database')
    }
    const data = await response.json()
    
    // Transform database data to match your frontend format
    return data.map(section => ({
      id: section.sectionId || section._id,
      code: section.abbreviation || `${section.subject}${section.courseNumber}`,
      name: section.courseName,
      active: section.sectionType !== 'cancelled',
      subject: section.subject,
      professors: extractInstructorNames(section.instructors),
      term: section.termTitle,
      sectionNumber: section.sectionNumber,
      sectionType: section.sectionType,
      schedule: parseSchedule(section.schedule),
      hours: section.hours,
      rmpData: {}
    }))
  } catch (error) {
    console.error('Error fetching classes from database:', error)
    return null
  }
}

// Fetch RMP ratings data
export async function fetchRMPData() {
  try {
    const response = await fetch('/api/rmp-ratings');
    
    if (!response.ok) {
      console.warn('RMP data not available');
      return {};
    }
    
    const data = await response.json();
    
    const rmpMap = {};
    data.forEach(rating => {
      const normalizedName = normalizeInstructorName(rating.instructorName);
      const key = `${rating.courseId}|${normalizedName}`;
      rmpMap[key] = {
        quality: rating.averageQuality,
        difficulty: rating.averageDifficulty,
        lastUpdated: rating.lastUpdated
      };
    });
    
    console.log('RMP Data loaded:', Object.keys(rmpMap).length, 'entries');
    return rmpMap;
  } catch (error) {
    console.error('Error fetching RMP data:', error);
    return {};
  }
}

// Enhanced function to fetch classes with RMP data
export async function fetchClassesWithRatings() {
  try {
    const [classes, rmpData] = await Promise.all([
      fetchClassesFromDB(),
      fetchRMPData()
    ]);
    
    if (!classes) return null;
    
    return classes.map(cls => {
      const rmpRatings = {};
      
      cls.professors.forEach(professor => {
        const key = `${cls.code}|${professor}`;
        if (rmpData[key]) {
          rmpRatings[professor] = rmpData[key];
        }
      });
      
      return {
        ...cls,
        rmpData: rmpRatings
      };
    });
  } catch (error) {
    console.error('Error fetching classes with ratings:', error);
    return null;
  }
}

// Helper function to get average ratings for a class
export function getClassAverageRatings(cls) {
  const ratings = Object.values(cls.rmpData || {});
  if (ratings.length === 0) return null;
  
  const qualityRatings = ratings.filter(r => r.quality !== null && r.quality !== undefined).map(r => r.quality);
  const difficultyRatings = ratings.filter(r => r.difficulty !== null && r.difficulty !== undefined).map(r => r.difficulty);
  
  return {
    avgQuality: qualityRatings.length > 0 ? 
      qualityRatings.reduce((sum, q) => sum + q, 0) / qualityRatings.length : null,
    avgDifficulty: difficultyRatings.length > 0 ? 
      difficultyRatings.reduce((sum, d) => sum + d, 0) / difficultyRatings.length : null,
    hasData: qualityRatings.length > 0 || difficultyRatings.length > 0
  };
}

// Helper function to format rating display
export function formatRating(rating, type = 'quality') {
  if (!rating || rating === null || rating === undefined) return 'N/A';
  
  const value = rating.toFixed(1);
  let color = '#666';
  
  if (type === 'quality') {
    if (rating >= 4) color = '#4CAF50';
    else if (rating >= 3) color = '#FF9800';
    else color = '#f44336';
  } else {
    if (rating <= 2) color = '#4CAF50';
    else if (rating <= 3.5) color = '#FF9800';
    else color = '#f44336';
  }
  
  return { value, color };
}

// API function to save planned classes to database
export async function savePlannedClassesToDB(plannedClasses, userId = null) {
  try {
    // Use the authenticated save-schedule endpoint
    const scheduleName = `Plan ${new Date().toLocaleDateString()}`
    
    const response = await fetch('/api/auth/save-schedule', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        scheduleName,
        classes: plannedClasses
      })
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        removeAuthToken();
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(`Failed to save planned classes: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error saving planned classes to database:', error)
    throw error
  }
}

// API function to fetch degree requirements
export async function fetchDegreeRequirements(major = 'Computer Science') {
  try {
    const response = await fetch(`/api/degree-requirements?major=${encodeURIComponent(major)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch degree requirements: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Since your endpoint returns an array with find().toArray(), take the first element
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching degree requirements:', error);
    throw error;
  }
}

export async function fetchUserTakenCourses(email) {
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(email)}/courses`);

    if (!response.ok) {
      throw new Error(`Failed to fetch user courses: ${response.statusText}`);
    }

    const data = await response.json();
    return data; // should be an array of course objects
  } catch (error) {
    console.error('Error fetching user courses:', error);
    throw error;
  }
}

// Authentication API Functions

/**
 * Helper function to get auth token from localStorage
 * Returns null if no token exists
 */
function getAuthToken() {
  return localStorage.getItem('authToken');
}

/**
 * Helper function to set auth token in localStorage
 * Stores JWT token for authenticated requests
 */
function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

/**
 * Helper function to remove auth token from localStorage
 * Used during logout or when token is invalid
 */
function removeAuthToken() {
  localStorage.removeItem('authToken');
}

/**
 * Helper function to get auth headers for API requests
 * Includes Content-Type and Authorization Bearer token if available
 */
function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

/**
 * Register a new user with complete profile data
 * Sends user data from multi-step registration to backend
 * Automatically stores JWT token on successful registration
 * 
 * @param {Object} userData - Complete user profile data including:
 *   - email, password, name (from login form)
 *   - major, year, dorm (from registration steps)
 *   - previousCourses (optional array of course objects)
 * @returns {Object} Registration response with user data and token
 */
export async function registerUser(userData) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Store token in localStorage for future authenticated requests
    if (data.token) {
      setAuthToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

/**
 * Login user with email and password
 * Authenticates user credentials and stores JWT token
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Object} Login response with user data and token
 */
export async function loginUser(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store token in localStorage for future authenticated requests
    if (data.token) {
      setAuthToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Get user profile (protected)
export async function getUserProfile() {
  try {
    const response = await fetch('/api/auth/profile', {
      method: 'GET',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Token is invalid, remove it
        removeAuthToken();
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(data.error || 'Failed to fetch profile');
    }

    return data;
  } catch (error) {
    console.error('Get profile error:', error);
    throw error;
  }
}

// Save user schedule (protected)
export async function saveUserSchedule(scheduleName, classes) {
  try {
    const response = await fetch('/api/auth/save-schedule', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ scheduleName, classes })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        removeAuthToken();
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(data.error || 'Failed to save schedule');
    }

    return data;
  } catch (error) {
    console.error('Save schedule error:', error);
    throw error;
  }
}

// Get user schedules (protected)
export async function getUserSchedules() {
  try {
    const response = await fetch('/api/auth/schedules', {
      method: 'GET',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        removeAuthToken();
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(data.error || 'Failed to fetch schedules');
    }

    return data;
  } catch (error) {
    console.error('Get schedules error:', error);
    throw error;
  }
}

/**
 * Logout user by removing stored authentication token
 * Clears localStorage and effectively ends user session
 */
export function logoutUser() {
  removeAuthToken();
}

/**
 * Check if user is currently authenticated
 * Returns true if valid token exists in localStorage
 * 
 * @returns {boolean} Authentication status
 */
export function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Get current authentication token from localStorage
 * Returns null if no token exists
 * 
 * @returns {string|null} Current auth token
 */
export function getCurrentToken() {
  return getAuthToken();
}

// Save past courses (completed)
export async function savePastCoursesToDB(courses) {
  try {
    const response = await fetch('/api/auth/past-courses', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ courses })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        removeAuthToken();
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(data.error || 'Failed to save past courses');
    }

    return data;
  } catch (error) {
    console.error('Save past courses error:', error);
    throw error;
  }
}

// export async function getCourseRecommendations(preferences, major = 'Computer Science', userEmail = null, plannedClasses = []) {
//   const [allClasses, degreeData, takenCourses] = await Promise.all([
//     fetchClassesWithRatings(),
//     fetchDegreeRequirements(major),
//     userEmail ? fetchUserTakenCourses(userEmail) : Promise.resolve([])
//   ]);

//   const neededCourses = identifyNeededCoursesHelper(degreeData, takenCourses, plannedClasses);
  
//   const recommendations = generateRecommendations({
//     preferences,
//     allClasses,
//     degreeData,
//     takenCourses,
//     plannedClasses
//   });

//   return recommendations.map(rec => ({
//     ...rec,
//     recommendationReasons: formatReasons(rec, neededCourses)
//   }));
// }

// export async function getCourseRecommendations(preferences, major = 'Computer Science', userEmail = null, plannedClasses = []) {
//   const [allClasses, degreeData, takenCourses] = await Promise.all([
//     fetchClassesWithRatings(),
//     fetchDegreeRequirements(major),
//     userEmail ? fetchUserTakenCourses(userEmail) : Promise.resolve([])
//   ]);

//   const neededCourses = identifyNeededCoursesHelper(degreeData, takenCourses, plannedClasses);
  
//   const recommendations = generateRecommendations({
//     preferences,
//     allClasses,
//     degreeData,
//     takenCourses,
//     plannedClasses
//   });

//   // Add GPT enhancement
//   const enhanced = await enhanceWithGPT(recommendations, {
//     preferences,
//     degreeData,
//     takenCourses,
//     plannedClasses
//   });

//   return enhanced.map(rec => ({
//     ...rec,
//     recommendationReasons: formatReasons(rec, neededCourses)
//   }));
// }


const recommendationCache = new Map();

function makeCacheKey(preferences, major) {
  // Sort preference keys for consistent key string
  const prefKeys = Object.keys(preferences).sort();
  const prefString = prefKeys.map(key => `${key}:${JSON.stringify(preferences[key])}`).join('|');
  return `${major}::${prefString}`;
}

export async function getCourseRecommendations(preferences, major, userEmail, plannedClasses) {
  try {
    const cacheKey = makeCacheKey(preferences, major);

    if (recommendationCache.has(cacheKey)) {
      console.log('⚡ Returning cached recommendations for:', { major, preferences });
      return recommendationCache.get(cacheKey);
    }

    console.log('🎯 Fetching new recommendations for:', { major, preferences });

    const recommendationResult = await _getCourseRecommendationsInternal(preferences, major, userEmail, plannedClasses);

    recommendationCache.set(cacheKey, recommendationResult);
    console.log('⚡ Cached recommendations for:', { major, preferences });

    return recommendationResult;

  } catch (error) {
    console.error('❌ Error getting recommendations:', error);
    throw error;
  }
}

async function _getCourseRecommendationsInternal(preferences, major, userEmail, plannedClasses) {
  try {
    console.log('🎯 Starting internal recommendation generation:', { major, userEmail, planType: preferences.planType });

    // 1. Fetch user's taken courses
    let takenCourses = [];
    if (userEmail) {
      try {
        takenCourses = await fetchUserTakenCourses(userEmail);
        console.log('✓ Taken courses:', takenCourses.length);
      } catch (err) {
        console.warn('⚠️ Could not fetch taken courses:', err.message);
      }
    }

    // 2. Fetch all classes from DB
    const allClasses = await fetchClassesFromDB();
    if (!allClasses || allClasses.length === 0) {
      throw new Error('No classes available');
    }
    console.log('✓ All classes:', allClasses.length);
    console.log('✓ Sample class:', allClasses[0]);

    // 3. Fetch degree requirements
    let degreeData = null;
    try {
      const degreeResponse = await fetch(
        `http://localhost:3001/api/degree-requirements/${encodeURIComponent(major)}`
      );
      
      if (!degreeResponse.ok) {
        if (degreeResponse.status === 404) {
          console.warn(`⚠️ No degree requirements found for "${major}". Continuing without degree filtering.`);
        } else {
          throw new Error(`Failed to fetch degree requirements: ${degreeResponse.statusText}`);
        }
      } else {
        degreeData = await degreeResponse.json();
        console.log('✓ Degree data loaded');
      }
    } catch (err) {
      console.warn('⚠️ Error loading degree requirements:', err.message);
    }

    // 4. Fetch prerequisites for all courses
    let prerequisitesMap = {};
    try {
      const allCourseCodes = allClasses.map(cls => cls.code);
      prerequisitesMap = await fetchBatchPrerequisites(allCourseCodes);
      console.log('✓ Prerequisites loaded:', Object.keys(prerequisitesMap).length);
    } catch (err) {
      console.warn('⚠️ Error loading prerequisites:', err.message);
    }

    // 5. Route based on planType
    if (preferences.planType === 'four_year') {
      console.log('🎓 Generating 4-year plan...');
      
      const plan = generateFourYearPlan({
        preferences,
        allClasses,
        degreeData,
        takenCourses,
        plannedClasses,
        prerequisitesMap
      });

      console.log('✓ Generated 4-year plan:', plan.semesters.length, 'semesters');

      // Enhance with GPT (optional)
      try {
        plan.semesters = await enhanceSemestersWithGPT(plan.semesters, {
          preferences,
          degreeData,
          takenCourses,
          plannedClasses
        });
        console.log('🤖 Enhanced 4-year plan with GPT');
      } catch (err) {
        console.warn('⚠️ GPT enhancement failed for 4-year plan:', err.message);
      }

      return plan;

    } else {
      console.log('📚 Generating 1-semester recommendations...');
      
      const recommendations = generateRecommendations({
        preferences,
        allClasses,
        degreeData,
        takenCourses,
        plannedClasses,
        prerequisitesMap
      });

      console.log('✓ Generated recommendations:', recommendations.length);

      try {
        const enhanced = await enhanceWithGPT(recommendations, {
          preferences,
          degreeData,
          takenCourses,
          plannedClasses
        });
        return enhanced;
      } catch (err) {
        console.warn('⚠️ GPT enhancement failed, returning basic recommendations:', err.message);
        return recommendations;
      }
    }

  } catch (error) {
    console.error('❌ Internal error generating recommendations:', error);
    throw error;
  }
}


/**
 * Optional: Enhance 4-year plan semesters with GPT insights
 * WARNING: This can be slow and expensive (8 GPT calls)
 */
async function enhanceSemestersWithGPT(semesters, context) {
  const semestersToEnhance = semesters.filter(sem => sem.courses.length > 0);
  
  console.log(`🤖 Enhancing ${semestersToEnhance.length} semesters with GPT...`);
  
  // Process one at a time to avoid rate limits
  for (let i = 0; i < semestersToEnhance.length; i++) {
    const semester = semestersToEnhance[i];
    
    try {
      console.log(`  Enhancing ${semester.name}...`);
      const enhanced = await enhanceWithGPT(semester.courses, context);
      semester.courses = enhanced;
      
      // Small delay between requests
      if (i < semestersToEnhance.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.warn(`  ⚠️ Failed to enhance ${semester.name}:`, err.message);
      // Continue with non-enhanced courses
    }
  }
  
  return semesters;
}

function identifyNeededCoursesHelper(degreeData, takenCourses, plannedClasses) {
  if (!degreeData?.categories) return { codes: new Set(), priorities: {} };
  
  const completed = new Set([
    ...takenCourses.map(tc => tc.courseCode || tc.code),
    ...plannedClasses.map(pc => pc.code)
  ]);

  const needed = { codes: new Set(), priorities: {} };
  
  degreeData.categories.forEach(cat => {
    cat.availableClasses.forEach(cls => {
      if (!completed.has(cls.code)) {
        needed.codes.add(cls.code);
        needed.priorities[cls.code] = cls.required ? 3 : 2;
      }
    });
  });
  
  return needed;
}

function formatReasons(cls, neededCourses) {
  const reasons = [];
  if (neededCourses.codes.has(cls.code)) {
    reasons.push(neededCourses.priorities[cls.code] === 3 ? 'Required for degree' : 'Fulfills degree requirement');
  }
  const ratings = Object.values(cls.rmpData || {});
  if (ratings.length > 0) {
    const avgQ = ratings.reduce((sum, r) => sum + (r.quality || 0), 0) / ratings.length;
    if (avgQ >= 4) reasons.push(`Highly rated (${avgQ.toFixed(1)}/5.0)`);
  }
  if (cls.schedule?.days) reasons.push(`Meets ${cls.schedule.days.join('/')}`);
  return reasons;
}


/**
 * Fetch prerequisites for a single course
 */
export async function fetchCoursePrerequisites(courseCode) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/courses/${encodeURIComponent(courseCode)}/prerequisites`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch prerequisites: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching prerequisites:', error);
    throw error;
  }
}

/**
 * Fetch prerequisites for multiple courses in one request
 */
export async function fetchBatchPrerequisites(courseCodes) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/courses/prerequisites/batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courseCodes }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch batch prerequisites: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching batch prerequisites:', error);
    // Return empty map so recommendations still work without prerequisites
    return {};
  }
}