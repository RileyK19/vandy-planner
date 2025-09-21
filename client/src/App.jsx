import React, { useState, useMemo, useEffect } from 'react'
import './App.css'
import { fetchClassesFromDB, savePlannedClassesToDB } from './api.jsx'
import { mockClasses } from './mockData.jsx'
import PlannerCalendar from './PlannerCalendar.jsx'
import Modal from './Modal.jsx'// In App.js, replace fetchClassesFromDB() with:
import { fetchClassesWithRatings, getClassAverageRatings, formatRating } from './api.jsx'


function App() {
  const [currentView, setCurrentView] = useState('search') // 'search' or 'planner'
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState({})
  const [infoClass, setInfoClass] = useState(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [allClasses, setAllClasses] = useState([])
  const [plannedClasses, setPlannedClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [usingMockData, setUsingMockData] = useState(false)

  // Load planned classes from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('plannedClasses')
    if (saved) {
      try {
        setPlannedClasses(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading planned classes:', error)
      }
    }
  }, [])

  // Save planned classes to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('plannedClasses', JSON.stringify(plannedClasses))
  }, [plannedClasses])

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

  const filterableKeys = useMemo(() => {
    if (allClasses.length === 0) return []
    return Object.keys(allClasses[0]).filter(
      (k) => !['id', 'code', 'name'].includes(k)
    )
  }, [allClasses])

  const attributeOptions = useMemo(() => {
    const options = {}
    filterableKeys.forEach((key) => {
      let valuesSet = new Set()
      allClasses.forEach((cls) => {
        const val = cls[key]
        if (Array.isArray(val)) {
          val.forEach((v) => valuesSet.add(v))
        } else {
          valuesSet.add(val)
        }
      })
      options[key] = Array.from(valuesSet)
    })
    return options
  }, [filterableKeys, allClasses])

  function toggleFilter(key, value) {
    setSelectedFilters((prev) => {
      const prevSet = prev[key] || new Set()
      const newSet = new Set(prevSet)
      if (newSet.has(value)) {
        newSet.delete(value)
      } else {
        newSet.add(value)
      }
      return {
        ...prev,
        [key]: newSet,
      }
    })
  }

  const filteredClasses = allClasses.filter((cls) => {
    const searchMatch =
      cls.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.name.toLowerCase().includes(searchTerm.toLowerCase())
    if (!searchMatch) return false

    for (const key of filterableKeys) {
      const selectedValues = selectedFilters[key]
      if (!selectedValues || selectedValues.size === 0) continue

      const clsVal = cls[key]

      if (Array.isArray(clsVal)) {
        if (!clsVal.some((v) => selectedValues.has(v))) return false
      } else {
        if (!selectedValues.has(clsVal)) return false
      }
    }
    return true
  })

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
    // Check if class is already planned
    const isAlreadyPlanned = plannedClasses.some(cls => cls.id === classItem.id)
    if (isAlreadyPlanned) {
      alert('This class is already in your planner!')
      return
    }

    // Check for time conflicts
    const hasConflict = plannedClasses.some(plannedClass => {
      if (!classItem.schedule || !plannedClass.schedule) return false
      
      const newDays = Array.isArray(classItem.schedule.days) ? classItem.schedule.days : [classItem.schedule.days]
      const plannedDays = Array.isArray(plannedClass.schedule.days) ? plannedClass.schedule.days : [plannedClass.schedule.days]
      
      // Check if they share any days
      const sharedDays = newDays.some(day => plannedDays.includes(day))
      if (!sharedDays) return false
      
      // Check time overlap
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
      const confirmed = window.confirm('This class conflicts with another class in your planner. Add anyway?')
      if (!confirmed) return
    }

    setPlannedClasses(prev => [...prev, classItem])
  }

  const removeFromPlanner = (classId) => {
    setPlannedClasses(prev => prev.filter(cls => cls.id !== classId))
  }

  const handleSavePlan = async () => {
    try {
      await savePlannedClassesToDB(plannedClasses)
      console.log('Plan saved successfully!')
    } catch (error) {
      console.error('Failed to save plan:', error)
      throw error // Re-throw so the component can handle it
    }
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
    <div className="app-container">
      <div className="app-header">
        <h1>Vandy Planner</h1>
        <div>
          <button
            onClick={() => setCurrentView('search')}
            className={`nav-button ${currentView === 'search' ? 'active' : ''}`}
            style={{ 
              marginRight: '10px', 
              padding: '8px 16px',
              backgroundColor: currentView === 'search' ? '#4CAF50' : '#f0f0f0',
              color: currentView === 'search' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔍 Search Classes
          </button>
          <button
            onClick={() => setCurrentView('planner')}
            className={`nav-button ${currentView === 'planner' ? 'active' : ''}`}
            style={{ 
              marginRight: '10px', 
              padding: '8px 16px',
              backgroundColor: currentView === 'planner' ? '#4CAF50' : '#f0f0f0',
              color: currentView === 'planner' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📅 My Planner ({plannedClasses.length})
          </button>
          {usingMockData && (
            <button
              onClick={refreshData}
              className="refresh-button"
              title="Try to load from database"
              style={{ marginRight: '10px', fontSize: '12px', padding: '5px 10px' }}
            >
              🔄 Refresh
            </button>
          )}
          <button
            onClick={() => setShowInfoModal(true)}
            className="info-button"
            aria-label="Show app info"
          >
            i
          </button>
        </div>
      </div>

      {currentView === 'search' ? (
        // Search View
        <div>
          {usingMockData && (
            <div style={{ 
              background: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              padding: '10px', 
              margin: '10px 0',
              borderRadius: '5px',
              fontSize: '14px'
            }}>
              ⚠️ Using sample data - database connection not available. Click refresh to try again.
            </div>
          )}

          <input
            type="text"
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <button
            onClick={() => setShowFilter(true)}
            className="button"
          >
            Show Filters
          </button>

          <div style={{ margin: '10px 0', fontSize: '14px', color: '#666' }}>
            Showing {filteredClasses.length} of {allClasses.length} classes
          </div>

          <ul className="class-list">
            {filteredClasses.length === 0 && <li>No classes found.</li>}
            {filteredClasses.map((cls) => (
                <li key={`${cls.id}-${cls.sectionNumber}-${cls.term}`} className="class-item">
                <div
                  onClick={() => setInfoClass(cls)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setInfoClass(cls)
                  }}
                  aria-label={`Show details for ${cls.code}: ${cls.name}`}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  <strong>{cls.code}</strong>: {cls.name}
                  <span
                    className="class-status"
                    style={{ color: cls.active ? 'green' : 'red' }}
                  >
                    ({cls.active ? 'Active' : 'Inactive'})
                  </span>
                  <div className="class-meta">
                    Prof: {cls.professors.join(', ')} | Term: {cls.term}
                    {cls.sectionNumber && ` | Section: ${cls.sectionNumber}`}
                  </div>
                  {(() => {
                    const avg = getClassAverageRatings(cls)
                    if (!avg?.hasData) return null

                    const quality = formatRating(avg.avgQuality, 'quality')
                    const difficulty = formatRating(avg.avgDifficulty, 'difficulty')

                    return (
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>
                        <span style={{ color: quality.color }}>⭐ Quality: {quality.value}</span> |{' '}
                        <span style={{ color: difficulty.color }}>💪 Difficulty: {difficulty.value}</span>
                        </div>
                    )
                  })()}

                </div>
                <button
                  onClick={() => addToPlanner(cls)}
                  style={{
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    marginLeft: '10px'
                  }}
                  disabled={plannedClasses.some(planned => planned.id === cls.id)}
                >
                  {plannedClasses.some(planned => planned.id === cls.id) ? '✓ Added' : '+ Add'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // Planner View
        <PlannerCalendar 
          plannedClasses={plannedClasses} 
          onRemoveClass={removeFromPlanner}
          onSavePlan={handleSavePlan}
        />
      )}

      {/* Filter Modal */}
      {showFilter && (
        <Modal onClose={() => setShowFilter(false)}>
          <h2>Filters</h2>
          {filterableKeys.map((key) => (
            <div key={key} className="filter-section">
              <strong>{key}</strong>
              <div className="filter-options">
                {attributeOptions[key].map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={
                        selectedFilters[key]
                          ? selectedFilters[key].has(option)
                          : false
                      }
                      onChange={() => toggleFilter(key, option)}
                    />
                    {String(option)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </Modal>
      )}

      {/* Info Modal */}
      {infoClass && (
        <Modal onClose={() => setInfoClass(null)}>
          <h2>{infoClass.code}: {infoClass.name}</h2>
          <p><strong>Subject:</strong> {infoClass.subject}</p>
          <p><strong>Professors:</strong> {infoClass.professors.join(', ')}</p>
          <p><strong>Term:</strong> {infoClass.term}</p>
          {infoClass.sectionNumber && (
            <p><strong>Section:</strong> {infoClass.sectionNumber}</p>
          )}
          {infoClass.sectionType && (
            <p><strong>Type:</strong> {infoClass.sectionType}</p>
          )}
          {infoClass.hours && (
            <p><strong>Credit Hours:</strong> {infoClass.hours}</p>
          )}
          {(() => {
            const avg = getClassAverageRatings(infoClass)
            if (!avg?.hasData) return null

            const quality = formatRating(avg.avgQuality, 'quality')
            const difficulty = formatRating(avg.avgDifficulty, 'difficulty')

            return (
                <div style={{ marginTop: '10px' }}>
                <p><strong>RMP Ratings (Avg):</strong></p>
                <ul style={{ marginLeft: '20px' }}>
                    <li><strong>Quality:</strong> <span style={{ color: quality.color }}>{quality.value}</span></li>
                    <li><strong>Difficulty:</strong> <span style={{ color: difficulty.color }}>{difficulty.value}</span></li>
                </ul>
                </div>
            )
          })()}

          {infoClass.schedule && (
            <div>
              <p><strong>Schedule:</strong></p>
              <ul style={{ marginLeft: '20px' }}>
                <li><strong>Days:</strong> {Array.isArray(infoClass.schedule.days) ? infoClass.schedule.days.join(', ') : infoClass.schedule.days}</li>
                <li><strong>Time:</strong> {infoClass.schedule.startTime} - {infoClass.schedule.endTime}</li>
                {infoClass.schedule.location && <li><strong>Location:</strong> {infoClass.schedule.location}</li>}
              </ul>
            </div>
          )}
          <p>
            <strong>Status:</strong>{' '}
            <span style={{ color: infoClass.active ? 'green' : 'red' }}>
              {infoClass.active ? 'Active' : 'Inactive'}
            </span>
          </p>
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={() => {
                addToPlanner(infoClass)
                setInfoClass(null)
              }}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
              disabled={plannedClasses.some(planned => planned.id === infoClass.id)}
            >
              {plannedClasses.some(planned => planned.id === infoClass.id) ? '✓ Already Added' : '+ Add to Planner'}
            </button>
          </div>
        </Modal>
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
            <li>💾 Submit your plan to database</li>
            <li>🔄 Refresh to try loading from database</li>
          </ul>
          <p className="footer-note">
            Built with ❤️ for CS students
            {usingMockData ? ' (Currently using sample data)' : ' (Connected to database)'}
          </p>
        </Modal>
      )}
    </div>
  )
}

export default App