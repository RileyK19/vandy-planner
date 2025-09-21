// api.js - API functions for database operations

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
  
  // Remove extra whitespace
  name = name.trim();
  
  // Handle "Last, First Middle" format -> "First Last"
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const lastName = parts[0];
      const firstName = parts[1].split(' ')[0]; // Take only first name, ignore middle
      return `${firstName} ${lastName}`;
    }
  }
  
  return name;
}

// Helper function to extract instructor names from various formats
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

// Get API base URL based on environment
const getAPIBase = () => {
  if (typeof window !== 'undefined') {
    // Client-side
    return process.env.NODE_ENV === 'production' 
      ? 'https://your-backend-url.vercel.app' // Replace with your actual backend URL
      : 'http://localhost:3001';
  }
  return 'http://localhost:3001'; // Server-side fallback
};

// API functions to fetch data from your backend
export async function fetchClassesFromDB() {
  try {
    const apiBase = getAPIBase();
    const response = await fetch(`${apiBase}/api/classes`);
    
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
      // Add RMP data placeholders - will be populated by fetchRMPData
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
    const apiBase = getAPIBase();
    const response = await fetch(`${apiBase}/api/rmp-ratings`);
    
    if (!response.ok) {
      console.warn('RMP data not available');
      return {};
    }
    
    const data = await response.json();
    
    // Create lookup map: courseId|instructorName -> ratings
    const rmpMap = {};
    data.forEach(rating => {
      // Normalize the instructor name from RMP data too
      const normalizedName = normalizeInstructorName(rating.instructorName);
      const key = `${rating.courseId}|${normalizedName}`;
      rmpMap[key] = {
        quality: rating.averageQuality,
        difficulty: rating.averageDifficulty,
        lastUpdated: rating.lastUpdated
      };
    });
    
    console.log('RMP Data loaded:', Object.keys(rmpMap).length, 'entries');
    console.log('Sample keys:', Object.keys(rmpMap).slice(0, 5));
    
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
    
    // Debug logging
    console.log('Classes loaded:', classes.length);
    console.log('RMP data keys available:', Object.keys(rmpData).length);
    
    // Merge RMP data with class data
    return classes.map(cls => {
      const rmpRatings = {};
      let foundRatings = 0;
      
      // For each professor, try to find RMP data
      cls.professors.forEach(professor => {
        const key = `${cls.code}|${professor}`;
        console.log(`Looking for RMP data with key: "${key}"`);
        
        if (rmpData[key]) {
          rmpRatings[professor] = rmpData[key];
          foundRatings++;
          console.log(`Found RMP data for ${professor}:`, rmpData[key]);
        } else {
          console.log(`No RMP data found for ${professor}`);
        }
      });
      
      if (foundRatings > 0) {
        console.log(`Class ${cls.code} has ${foundRatings} professors with RMP data`);
      }
      
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
    // Quality: 1-5 scale, higher is better
    if (rating >= 4) color = '#4CAF50'; // Green
    else if (rating >= 3) color = '#FF9800'; // Orange  
    else color = '#f44336'; // Red
  } else {
    // Difficulty: 1-5 scale, lower is easier
    if (rating <= 2) color = '#4CAF50'; // Green (easy)
    else if (rating <= 3.5) color = '#FF9800'; // Orange (medium)
    else color = '#f44336'; // Red (hard)
  }
  
  return { value, color };
}

// API function to save planned classes to database
export async function savePlannedClassesToDB(plannedClasses, userId = null) {
  try {
    // TODO: Replace with actual user ID when user authentication is implemented
    // For now, using a placeholder or browser-specific identifier
    const tempUserId = userId || `temp_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const planData = {
      userId: tempUserId,
      plannedClasses: plannedClasses,
      totalCredits: plannedClasses.reduce((total, cls) => total + (cls.hours || 0), 0),
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }

    const apiBase = getAPIBase();
    const response = await fetch(`${apiBase}/api/planned-classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(planData)
    })

    if (!response.ok) {
      throw new Error(`Failed to save planned classes: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error saving planned classes to database:', error)
    throw error
  }
}