import { useState, useMemo } from 'react'

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
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'transparent',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
          aria-label="Close modal"
        >
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
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: 600, margin: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Vandy Planner</h1>
        <button
          onClick={() => setShowInfoModal(true)} 
          aria-label="Show app info"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: '1.5px solid #333',
            background: 'white',
            color: '#333',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: '22px',
            padding: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          i
        </button>
      </div>
      <input
        type="text"
        placeholder="Search classes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ padding: '0.5rem', width: '100%', marginBottom: '1rem' }}
      />
      <button
        onClick={() => setShowFilter(true)}
        style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}
      >
        Show Filters
      </button>

      <ul style={{ padding: 0, listStyle: 'none' }}>
        {filteredClasses.length === 0 && <li>No classes found.</li>}
        {filteredClasses.map((cls) => (
          <li
            key={cls.id}
            style={{
              borderBottom: '1px solid #ddd',
              padding: '0.5rem 0',
              cursor: 'pointer',
            }}
            onClick={() => setInfoClass(cls)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setInfoClass(cls)
            }}
            aria-label={`Show details for ${cls.code}: ${cls.name}`}
          >
            <strong>{cls.code}</strong>: {cls.name}{' '}
            <span
              style={{
                color: cls.active ? 'green' : 'red',
                fontStyle: 'italic',
                marginLeft: '0.5rem',
              }}
            >
              ({cls.active ? 'Active' : 'Inactive'})
            </span>
            <div style={{ fontSize: 12, color: '#555' }}>
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
            <div key={key} style={{ marginBottom: '1rem' }}>
              <strong style={{ textTransform: 'capitalize' }}>{key}</strong>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                {attributeOptions[key].map((option) => (
                  <label key={option} style={{ userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedFilters[key]
                          ? selectedFilters[key].has(option)
                          : false
                      }
                      onChange={() => toggleFilter(key, option)}
                      style={{ marginRight: '0.25rem' }}
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
          <p>
            <strong>Subject:</strong> {infoClass.subject}
          </p>
          <p>
            <strong>Professors:</strong> {infoClass.professors.join(', ')}
          </p>
          <p>
            <strong>Term:</strong> {infoClass.term}
          </p>
          <p>
            <strong>Status:</strong>{' '}
            <span style={{ color: infoClass.active ? 'green' : 'red' }}>
              {infoClass.active ? 'Active' : 'Inactive'}
            </span>
          </p>
        </Modal>
      )}

      {/* General Info Modal triggered by 'i' button */}
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
          <p style={{ marginTop: '1rem', fontSize: 12, color: '#666' }}>
            Built with ❤️ for CS students
          </p>
        </Modal>
      )}
    </div>
  )
}

export default App
