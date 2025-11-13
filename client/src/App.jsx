import React, { useState, useEffect } from 'react'
import './App.css'
import { 
  fetchClassesFromDB, 
  savePlannedClassesToDB, 
  isAuthenticated, 
  getUserProfile, 
  logoutUser,
  loadSemesterPlanner  // NEW: Import the new function
} from './api.jsx'
import { mockClasses } from './mockData.jsx'
import PlannerCalendar from './PlannerCalendar.jsx'
import Modal from './Modal.jsx'
import LoginPage from './LoginPage.jsx'
import DegreeAudit from './DegreeAudit.jsx'
import RecommendMe from './RecommendMe.jsx'
import SearchPage from './SearchPage.jsx'
import FourYearPlanner from './FourYearPlanner.jsx'
import ProfilePage from './ProfilePage.jsx'

import { fetchClassesWithRatings } from './api.jsx'

function App() {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
    
  // App state
  const [currentView, setCurrentView] = useState('search')
  const [allClasses, setAllClasses] = useState([])
  const [plannedClasses, setPlannedClasses] = useState([])
  const [semesterPlans, setSemesterPlans] = useState({})
  const [loading, setLoading] = useState(true)
  const [usingMockData, setUsingMockData] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)

  const [toast, setToast] = useState(null);

  // Create a helper function to show toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Check for existing authentication on mount and load user data
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken')
      if (token) {
        try {
          const userData = await getUserProfile()
          console.log('User profile loaded:', userData);
          setUser(userData)
          setIsLoggedIn(true)
          
          // NEW: Load one-semester planner from database
          try {
            console.log('📖 Loading semester planner from database...');
            const semesterPlan = await loadSemesterPlanner();
            
            if (semesterPlan && semesterPlan.classes && semesterPlan.classes.length > 0) {
              console.log('✅ Loaded semester planner:', {
                semester: semesterPlan.semesterName,
                classCount: semesterPlan.classes.length
              });
              setPlannedClasses(semesterPlan.classes);
              localStorage.setItem('plannedClasses', JSON.stringify(semesterPlan.classes));
            } else {
              console.log('ℹ️ No semester planner data found');
            }
          } catch (plannerError) {
            console.error('Error loading semester planner:', plannerError);
            // Don't fail - just continue with empty planner
          }
          
          // Load 4-year plans from plannedSchedules (EXISTING)
          if (userData.plannedSchedules && userData.plannedSchedules.length > 0) {
            console.log('📅 Loading 4-year plan from plannedSchedules...');
            const latestSchedule = userData.plannedSchedules[userData.plannedSchedules.length - 1]
            
            const semesterPlansFromDB = {}
            
            if (latestSchedule.classes && Array.isArray(latestSchedule.classes)) {
              latestSchedule.classes.forEach(course => {
                if (course.semester) {
                  if (!semesterPlansFromDB[course.semester]) {
                    semesterPlansFromDB[course.semester] = []
                  }
                  semesterPlansFromDB[course.semester].push({
                    id: course.courseId || course.id || course._id?.toString(),
                    code: course.code,
                    name: course.name,
                    hours: course.hours || 3,
                    subject: course.subject,
                    professors: course.professors || [],
                    term: course.term,
                    sectionNumber: course.sectionNumber,
                    active: course.active,
                    schedule: course.schedule
                  })
                }
              })
            }
            
            if (Object.keys(semesterPlansFromDB).length > 0) {
              setSemesterPlans(semesterPlansFromDB)
              localStorage.setItem('semesterPlans', JSON.stringify(semesterPlansFromDB))
              console.log('✅ Loaded 4-year plan:', Object.keys(semesterPlansFromDB).length, 'semesters');
            }
          } else {
            console.log('ℹ️ No 4-year plan found');
          }
        } catch (error) {
          console.error('Error loading user data:', error)
          localStorage.removeItem('authToken')
          setIsLoggedIn(false)
        }
      }
      setAuthLoading(false)
    }
    checkAuth()
  }, [])

  // Load planned classes from localStorage on mount (fallback)
  useEffect(() => {
    const saved = localStorage.getItem('plannedClasses')
    if (saved && plannedClasses.length === 0) {
      try {
        setPlannedClasses(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading planned classes from localStorage:', error)
      }
    }
  }, [])

  // REMOVED: Duplicate semester plans loading effect
  // The checkAuth effect now handles both planner and 4-year plan loading

  // Save planned classes to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('plannedClasses', JSON.stringify(plannedClasses))
  }, [plannedClasses])

  // Save semester plans to localStorage
  useEffect(() => {
    localStorage.setItem('semesterPlans', JSON.stringify(semesterPlans))
  }, [semesterPlans])

  // Fetch classes on component mount
  useEffect(() => {
    async function loadClasses() {
      setLoading(true)
      try {
        const dbClasses = await fetchClassesWithRatings()        
        if (dbClasses && dbClasses.length > 0) {
          setAllClasses(dbClasses)
          setUsingMockData(false)
        } else {
          setAllClasses(mockClasses)
          setUsingMockData(true)
        }
      } catch (error) {
        console.error('Error loading classes:', error)
        setAllClasses(mockClasses)
        setUsingMockData(true)
      } finally {
        setLoading(false)
      }
    }

    loadClasses()
  }, [])

  // Function to refresh data from database
  const refreshData = async () => {
    setLoading(true)
    try {
      const dbClasses = await fetchClassesWithRatings()
      if (dbClasses && dbClasses.length > 0) {
        setAllClasses(dbClasses)
        setUsingMockData(false)
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToPlanner = (classItem) => {
    const isAlreadyPlanned = plannedClasses.some(cls => cls.id === classItem.id)
    if (isAlreadyPlanned) {
      showToast('This class is already in your planner!', 'warning');
      return
    }

    const hasConflict = plannedClasses.some(plannedClass => {
      if (!classItem.schedule || !plannedClass.schedule) return false
      
      const newDays = Array.isArray(classItem.schedule.days) ? classItem.schedule.days : [classItem.schedule.days]
      const plannedDays = Array.isArray(plannedClass.schedule.days) ? plannedClass.schedule.days : [plannedClass.schedule.days]
      
      const sharedDays = newDays.some(day => plannedDays.includes(day))
      if (!sharedDays) return false
      
      const newStart = classItem.schedule.startTime
      const newEnd = classItem.schedule.endTime
      const plannedStart = plannedClass.schedule.startTime
      const plannedEnd = plannedClass.schedule.endTime
      
      if (!newStart || !newEnd || !plannedStart || !plannedEnd) return false
      
      const [newStartHour, newStartMin] = newStart.split(':').map(Number)
      const [newEndHour, newEndMin] = newEnd.split(':').map(Number)
      const [plannedStartHour, plannedStartMin] = plannedStart.split(':').map(Number)
      const [plannedEndHour, plannedEndMin] = plannedEnd.split(':').map(Number)
      
      const newStartMinutes = newStartHour * 60 + newStartMin
      const newEndMinutes = newEndHour * 60 + newEndMin
      const plannedStartMinutes = plannedStartHour * 60 + plannedStartMin
      const plannedEndMinutes = plannedEndHour * 60 + plannedEndMin
      
      return (newStartMinutes < plannedEndMinutes && newEndMinutes > plannedStartMinutes)
    })
    
    if (hasConflict) {
      showToast('This class conflicts with another class in your planner!', 'warning');
    } else {
      showToast('Class added successfully!', 'success');
    }

    setPlannedClasses(prev => [...prev, classItem])
  }

  const removeFromPlanner = (classId) => {
    setPlannedClasses(prev => prev.filter(cls => cls.courseId !== classId))
    showToast('Class removed successfully!', 'success');
  }

  const addToSemester = (semester, classItem) => {
    setSemesterPlans(prev => {
      const existing = prev[semester] || []
      const isAlreadyAdded = existing.some(cls => cls.id === classItem.id)
      
      if (isAlreadyAdded) {
        showToast('This class is already in your planner!', 'warning');
        return prev
      }
      
      return {
        ...prev,
        [semester]: [...existing, classItem]
      }
    })
  }

  const handleSaveFourYearPlan = async (planData) => {
    try {
      if (planData.futureCourses.length > 0) {
        // Format courses with full details for database
        const coursesToSave = planData.futureCourses.map(course => ({
          courseId: course.id,
          code: course.code,
          name: course.name,
          hours: course.hours || 3,
          semester: course.semester,
          subject: course.subject,
          professors: course.professors || [],
          term: course.term,
          sectionNumber: course.sectionNumber
        }))
        
        // Use existing 4-year plan endpoint
        await savePlannedClassesToDB(coursesToSave)
      }
      
      console.log('4-year plan saved successfully!')
    } catch (error) {
      console.error('Failed to save 4-year plan:', error)
      throw error
    }
  }

  // Authentication functions
  const handleLogin = async (userData) => {
    setAuthError('')
    setUser(userData)
    setIsLoggedIn(true)
    
    // NEW: Load semester planner immediately after login
    try {
      console.log('📖 Loading semester planner on login...');
      const semesterPlan = await loadSemesterPlanner();
      
      if (semesterPlan && semesterPlan.classes && semesterPlan.classes.length > 0) {
        console.log('✅ Loaded semester planner on login:', {
          semester: semesterPlan.semesterName,
          classCount: semesterPlan.classes.length
        });
        setPlannedClasses(semesterPlan.classes);
        localStorage.setItem('plannedClasses', JSON.stringify(semesterPlan.classes));
      }
    } catch (error) {
      console.error('Error loading semester planner on login:', error);
    }
    
    // Load 4-year plans from plannedSchedules (EXISTING)
    if (userData.plannedSchedules && userData.plannedSchedules.length > 0) {
      console.log('📅 Loading 4-year plans from login...');
      const latestSchedule = userData.plannedSchedules[userData.plannedSchedules.length - 1]
      
      const semesterPlansFromDB = {}
      
      if (latestSchedule.classes && Array.isArray(latestSchedule.classes)) {
        latestSchedule.classes.forEach(course => {
          if (course.semester) {
            if (!semesterPlansFromDB[course.semester]) {
              semesterPlansFromDB[course.semester] = []
            }
            semesterPlansFromDB[course.semester].push({
              id: course.courseId || course.id || course._id?.toString(),
              code: course.code,
              name: course.name,
              hours: course.hours || 3,
              subject: course.subject,
              professors: course.professors || [],
              term: course.term,
              sectionNumber: course.sectionNumber,
              active: course.active,
              schedule: course.schedule
            })
          }
        })
      }
      
      if (Object.keys(semesterPlansFromDB).length > 0) {
        setSemesterPlans(semesterPlansFromDB)
        localStorage.setItem('semesterPlans', JSON.stringify(semesterPlansFromDB))
        console.log('✅ Loaded 4-year plans on login:', Object.keys(semesterPlansFromDB).length, 'semesters');
      }
    }
  }

  const handleSignup = (userData) => {
    setAuthError('')
    setUser(userData)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    logoutUser()
    setUser(null)
    setIsLoggedIn(false)
    setPlannedClasses([])
    setSemesterPlans({})
    localStorage.removeItem('plannedClasses')
    localStorage.removeItem('semesterPlans')
  }

  // Show login page if not authenticated
  if (authLoading) {
    return (
      <div className="app-container">
        <div className="app-header">
          <h1>Vandy Planner</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} onSignup={handleSignup} />
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="app-header">
          <h1>Vandy Planner</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Loading classes...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div 
            className="sidebar-logo-container"
            style={{ cursor: 'pointer' }}
          >
            {!sidebarCollapsed && (
              <button
                onClick={() => setCurrentView('search')} 
              >
                  <img src="/cropped_logo.png?v=3" alt="Vandy Planner" className="sidebar-logo" />
              </button>
            )}
            
            {/* Hamburger Menu Icon */}
            <button 
              className="hamburger-menu"
              onClick={(e) => {
                e.stopPropagation();
                setSidebarCollapsed(!sidebarCollapsed);
              }}
              aria-label="Toggle sidebar"
            >
              {/* <span></span>
              <span></span>
              <span></span> */}
              {sidebarCollapsed && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 6 15 12 9 18"></polyline>
                </svg>
              )}
              {!sidebarCollapsed && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              )}
            </button>
          </div>
          {!sidebarCollapsed && user && (
            <div className="sidebar-user">
              <div className="user-avatar">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">Welcome back!</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            {!sidebarCollapsed && <div className="nav-section-title">Navigation</div>}
            <button 
              onClick={() => setCurrentView('search')} 
              className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
              title="Search Classes"
            >
              <span className="nav-icon">🔍</span>
              {!sidebarCollapsed && <span className="nav-text">Search Classes</span>}
            </button>
            <button 
              onClick={() => setCurrentView('planner')} 
              className={`nav-item ${currentView === 'planner' ? 'active' : ''}`}
              title="Next Semester Plan"
            >
              <span className="nav-icon">📅</span>
              {!sidebarCollapsed && <span className="nav-text">Next Semester Plan</span>}
              {plannedClasses.length > 0 && (
                <span className="nav-badge">{plannedClasses.length}</span>
              )}
            </button>
            <button 
              onClick={() => setCurrentView('audit')} 
              className={`nav-item ${currentView === 'audit' ? 'active' : ''}`}
              title="Degree Audit"
            >
              <span className="nav-icon">🎓</span>
              {!sidebarCollapsed && <span className="nav-text">Degree Audit</span>}
            </button>
            <button 
              onClick={() => setCurrentView('recommend')} 
              className={`nav-item ${currentView === 'recommend' ? 'active' : ''}`}
              title="Recommendation"
            >
              <span className="nav-icon">💡</span>
              {!sidebarCollapsed && <span className="nav-text">Recommendations</span>}
            </button>
            <button 
              onClick={() => setCurrentView('fouryear')} 
              className={`nav-item ${currentView === 'fouryear' ? 'active' : ''}`}
              title="Long-Term Plan"
            >
              <span className="nav-icon">🎯</span>
              {!sidebarCollapsed && <span className="nav-text">Long-Term Plan</span>}
            </button>
          </div>
          
          <div className="nav-section">
            {!sidebarCollapsed && <div className="nav-section-title">Account</div>}
            <button 
              onClick={() => setCurrentView('profile')} 
              className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
              title="My Profile"
            >
              <span className="nav-icon">👤</span>
              {!sidebarCollapsed && <span className="nav-text">My Profile</span>}
            </button>
          </div>
          
          <div className="nav-section">
            {!sidebarCollapsed && <div className="nav-section-title">Tools</div>}
            {usingMockData && (
              <button 
                onClick={refreshData}
                className="nav-item"
                title="Refresh Data"
              >
                <span className="nav-icon">🔄</span>
                {!sidebarCollapsed && <span className="nav-text">Refresh Data</span>}
              </button>
            )}
            <button 
              onClick={() => setShowInfoModal(true)}
              className="nav-item"
              title="About"
            >
              <span className="nav-icon">ℹ️</span>
              {!sidebarCollapsed && <span className="nav-text">About</span>}
            </button>
          </div>
        </nav>
        
        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button 
            onClick={handleLogout}
            className="logout-button"
            title="Logout"
          >
            <span className="nav-icon">🚪</span>
            {!sidebarCollapsed && <span className="nav-text">Logout</span>}
          </button>
        </div>
      </div>
      
      <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {currentView === 'search' ? (
          <SearchPage 
            allClasses={allClasses}
            plannedClasses={plannedClasses}
            onAddToPlanner={addToPlanner}
            usingMockData={usingMockData}
            onRefreshData={refreshData}
            semesterPlans={semesterPlans}
            onAddToSemester={addToSemester}
            userMajor={user?.major || 'Computer Science'}
            year={user.year}
            onRemoveClass={removeFromPlanner}
          />
        ) : currentView === 'planner' ? (
          <PlannerCalendar 
            plannedClasses={plannedClasses} 
            onRemoveClass={removeFromPlanner}
          />
        ) : currentView === 'recommend' ? (
          <RecommendMe
            knownProfessors={[...new Set(allClasses.flatMap(cls => cls.professors || []))]}
            major={user?.major || "Computer Science"}
            userEmail={user?.email}
            plannedClasses={plannedClasses}
            onAddToPlanner={(course) => {
              addToPlanner(course)
            }}
          />
        ) : currentView === 'fouryear' ? (
          <FourYearPlanner 
            allClasses={allClasses}
            onSavePlan={handleSaveFourYearPlan}
            semesterPlans={semesterPlans}
            onUpdateSemesterPlans={setSemesterPlans}
            year={user.year}
            takenCourses={user.previousCourses}
          />
        ) : currentView === 'profile' ? (
          <ProfilePage 
            user={user}
            onProfileUpdate={(updatedUser) => {
              setUser(updatedUser);
            }}
          />
        ) : (
          <DegreeAudit 
            plannedClasses={plannedClasses}
            major="Computer Science"
            userEmail={user?.email}
            semesterPlans={semesterPlans}
          />
        )}

        {/* Info Modal (App Info) */}
        {showInfoModal && (
          <Modal onClose={() => setShowInfoModal(false)}>
            <h2>About Vandy Planner</h2>
            <h3>Eddy You, Kevin Song, Riley Koo || Principles of SWE || 2025 Fall</h3>
            <p>This tool helps you browse, filter, and explore Vanderbilt courses.</p>
            <ul>
              <li>🔍 Search by course code or name</li>
              <li>🎯 Filter by professor, subject, term, or status</li>
              <li>📄 Click a course to view details</li>
              <li>➕ Add classes to your semester planner</li>
              <li>📅 View your planned classes in calendar format</li>
              <li>🎓 Check degree requirements and track progress</li>
              <li>🎯 Plan courses up to 4 years in advance</li>
              <li>💾 Submit your plan to database</li>
              <li>🔄 Refresh to try loading from database</li>
            </ul>
            <p className="footer-note">
              Built with ❤️ for CS students
              {usingMockData ? ' (Currently using sample data)' : ' (Connected to database)'}
            </p>
          </Modal>
        )}
        {toast && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: toast.type === 'error' ? '#ff4444' : 
                            toast.type === 'warning' ? '#ff9800' : '#4CAF50',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10000
          }}>
            {toast.message}
          </div>
        )}
      </div>
    </>
  )
}

export default App