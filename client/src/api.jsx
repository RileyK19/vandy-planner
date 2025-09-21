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
      professors: section.instructors?.map(instructor => instructor.name || instructor) || [],
      term: section.termTitle,
      sectionNumber: section.sectionNumber,
      sectionType: section.sectionType,
      schedule: parseSchedule(section.schedule),
      hours: section.hours,
    }))
  } catch (error) {
    console.error('Error fetching classes from database:', error)
    return null
  }
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