import { useState, useMemo, useEffect } from 'react'
import './App.css' 

// Mock Data (fallback when database isn't available)
const mockClasses = [
  {
    id: 1,
    code: 'CS1101',
    name: 'Intro to Computer Science',
    active: true,
    subject: 'CS',
    professors: ['Rui Bai'],
    term: 'Fall 2025',
  },
  {
    id: 2,
    code: 'CS2201',
    name: 'Data Structures and Program Design',
    active: true,
    subject: 'CS',
    professors: ['Gerald Roth'],
    term: 'Spring 2025',
  },
  {
    id: 4,
    code: 'CS4287',
    name: 'Principles of Cloud Computing',
    active: true,
    subject: 'CS',
    professors: ['Vikash Singh'],
    term: 'Fall 2025',
  },
  {
    id: 5,
    code: 'CS4278',
    name: 'Principles of Software Engineering',
    active: false,
    subject: 'CS',
    professors: ['Vikash Singh', 'Darren Pulsipher'],
    term: 'Spring 2025',
  },
]

// API functions to fetch data from your backend
async function fetchClassesFromDB() {
  try {
    const response = await fetch('/api/classes') // You'll need to create this endpoint
    if (!response.ok) {
      throw new Error('Failed to fetch classes from database')
    }
    const data = await response.json()
    
    // Transform database data to match your frontend format
    return data.map(section => ({
      id: section.sectionId || section._id,
      code: section.abbreviation || `${section.subject}${section.courseNumber}`,
      name: section.courseName,
      active: section.sectionType !== 'cancelled', // Adjust logic as needed
      subject: section.subject,
      professors: section.instructors?.map(instructor => instructor.name) || [],
      term: section.termTitle,
      sectionNumber: section.sectionNumber,
      sectionType: section.sectionType,
      schedule: section.schedule,
      hours: section.hours,
    }))
  } catch (error) {
    console.error('Error fetching classes from database:', error)
    return null // Return null to indicate failure
  }
}

function Modal({ onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          &times;
        </button>
        {children}
      </div>
    </div>
  )
}

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState({})
  const [infoClass, setInfoClass] = useState(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [allClasses, setAllClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [usingMockData, setUsingMockData] = useState(false)

  // Fetch classes on component mount
  useEffect(() => {
    async function loadClasses() {
      setLoading(true)
      try {
        const dbClasses = await fetchClassesFromDB()
        if (dbClasses && dbClasses.length > 0) {
          setAllClasses(dbClasses)
          setUsingMockData(false)
        } else {
          // Fallback to mock data
          setAllClasses(mockClasses)
          setUsingMockData(true)
        }
      } catch (error) {
        console.error('Error loading classes:', error)
        // Fallback to mock data
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
      const dbClasses = await fetchClassesFromDB()
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
          <li
            key={cls.id}
            className="class-item"
            onClick={() => setInfoClass(cls)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setInfoClass(cls)
            }}
            aria-label={`Show details for ${cls.code}: ${cls.name}`}
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
          </li>
        ))}
      </ul>

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
          {infoClass.schedule && (
            <p><strong>Schedule:</strong> {JSON.stringify(infoClass.schedule)}</p>
          )}
          <p>
            <strong>Status:</strong>{' '}
            <span style={{ color: infoClass.active ? 'green' : 'red' }}>
              {infoClass.active ? 'Active' : 'Inactive'}
            </span>
          </p>
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