// api.js - API functions for database operations

// API functions to fetch data from your backend
export async function fetchClassesFromDB() {
    try {
      const response = await fetch('/api/classes')
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
        schedule: section.schedule,
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
  
      const response = await fetch('/api/planned-classes', {
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