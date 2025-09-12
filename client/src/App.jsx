import { useState, useMemo } from 'react'
import './App.css' 

// Mock Data
const allClasses = [
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

  const filterableKeys = useMemo(() => {
    if (allClasses.length === 0) return []
    return Object.keys(allClasses[0]).filter(
      (k) => !['id', 'code', 'name'].includes(k)
    )
  }, [])

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
  }, [filterableKeys])

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

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>Vandy Planner</h1>
        <button
          onClick={() => setShowInfoModal(true)}
          className="info-button"
          aria-label="Show app info"
        >
          i
        </button>
      </div>

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
          </ul>
          <p className="footer-note">Built with ❤️ for CS students</p>
        </Modal>
      )}
    </div>
  )
}

export default App
