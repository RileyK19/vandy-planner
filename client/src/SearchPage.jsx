import React, { useState, useMemo } from 'react';
import Modal from './Modal.jsx';
import { getClassAverageRatings, formatRating } from './api.jsx';

const SearchPage = ({ 
  allClasses, 
  plannedClasses, 
  onAddToPlanner, 
  usingMockData, 
  onRefreshData,
  semesterPlans = {},
  onAddToSemester
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [infoClass, setInfoClass] = useState(null);
  const [showSemesterSelector, setShowSemesterSelector] = useState(null);
  const [hoveredConflict, setHoveredConflict] = useState(null);

  // Function to check if two courses have a time conflict
  const checkTimeConflict = (course1, course2) => {
    if (!course1.schedule || !course2.schedule) return false;
    
    const days1 = Array.isArray(course1.schedule.days) ? course1.schedule.days : [course1.schedule.days];
    const days2 = Array.isArray(course2.schedule.days) ? course2.schedule.days : [course2.schedule.days];
    
    // Check if they share any days
    const sharedDays = days1.some(day => days2.includes(day));
    if (!sharedDays) return false;
    
    const start1 = course1.schedule.startTime;
    const end1 = course1.schedule.endTime;
    const start2 = course2.schedule.startTime;
    const end2 = course2.schedule.endTime;
    
    if (!start1 || !end1 || !start2 || !end2) return false;
    
    // Parse times - handle formats like "11:15" or "11:15AM"
    const parseTime = (timeStr) => {
      const cleanTime = timeStr.replace(/[ap]m?/i, '').trim();
      const [hour, min] = cleanTime.split(':').map(Number);
      let hour24 = hour;
      
      if (timeStr.toLowerCase().includes('p') && hour !== 12) {
        hour24 = hour + 12;
      } else if (timeStr.toLowerCase().includes('a') && hour === 12) {
        hour24 = 0;
      }
      
      return hour24 * 60 + (min || 0);
    };
    
    const start1Minutes = parseTime(start1);
    const end1Minutes = parseTime(end1);
    const start2Minutes = parseTime(start2);
    const end2Minutes = parseTime(end2);
    
    // Check if time ranges overlap
    return (start1Minutes < end2Minutes && end1Minutes > start2Minutes);
  };

  // Function to get all courses that conflict with a given course
  const getConflictingCourses = (course) => {
    return plannedClasses.filter(plannedClass => checkTimeConflict(course, plannedClass));
  };

  // Get current and future semesters (no summer, chronologically ordered)
  // Hardcoded to start from Fall 2025
  const getAvailableSemesters = () => {
    const semesters = [];
    const startYear = 2025;
    
    // Generate 8 semesters = 4 years (Fall, Spring, Fall, Spring...)
    for (let i = 0; i < 8; i++) {
      const year = startYear + Math.floor(i / 2);
      const term = i % 2 === 0 ? 'Fall' : 'Spring';
      // For Spring semesters, use next year
      const semesterYear = term === 'Spring' ? year + 1 : year;
      semesters.push({ term, year: semesterYear, label: `${term} ${semesterYear}` });
    }
    
    return semesters;
  };

  const availableSemesters = getAvailableSemesters();

  const filterableKeys = useMemo(() => {
    if (allClasses.length === 0) return [];
    return Object.keys(allClasses[0]).filter(
      (k) => !['id', 'code', 'name'].includes(k)
    );
  }, [allClasses]);

  const attributeOptions = useMemo(() => {
    const options = {};
    filterableKeys.forEach((key) => {
      let valuesSet = new Set();
      allClasses.forEach((cls) => {
        const val = cls[key];
        if (Array.isArray(val)) {
          val.forEach((v) => valuesSet.add(v));
        } else {
          valuesSet.add(val);
        }
      });
      options[key] = Array.from(valuesSet);
    });
    return options;
  }, [filterableKeys, allClasses]);

  function toggleFilter(key, value) {
    setSelectedFilters((prev) => {
      const prevSet = prev[key] || new Set();
      const newSet = new Set(prevSet);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return {
        ...prev,
        [key]: newSet,
      };
    });
  }

  const filteredClasses = allClasses.filter((cls) => {
    const searchMatch =
      cls.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!searchMatch) return false;

    for (const key of filterableKeys) {
      const selectedValues = selectedFilters[key];
      if (!selectedValues || selectedValues.size === 0) continue;

      const clsVal = cls[key];

      if (Array.isArray(clsVal)) {
        if (!clsVal.some((v) => selectedValues.has(v))) return false;
      } else {
        if (!selectedValues.has(clsVal)) return false;
      }
    }
    return true;
  });

  const handleAddToSemester = (semester, classItem) => {
    onAddToSemester(semester.label, classItem);
    setShowSemesterSelector(null);
  };

  return (
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
                if (e.key === 'Enter') setInfoClass(cls);
              }}
              aria-label={`Show details for ${cls.code}: ${cls.name}`}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>{cls.code}</strong>: {cls.name}
                {(() => {
                  const conflicts = getConflictingCourses(cls);
                  if (conflicts.length > 0) {
                    return (
                      <span
                        style={{
                          color: 'red',
                          fontSize: '18px',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          setHoveredConflict({ course: cls, conflicts, x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={(e) => {
                          if (hoveredConflict && hoveredConflict.course.id === cls.id) {
                            setHoveredConflict({ course: cls, conflicts, x: e.clientX, y: e.clientY });
                          }
                        }}
                        onMouseLeave={() => setHoveredConflict(null)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        ⚠️
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
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
                const avg = getClassAverageRatings(cls);
                if (!avg?.hasData) return null;

                const quality = formatRating(avg.avgQuality, 'quality');
                const difficulty = formatRating(avg.avgDifficulty, 'difficulty');

                return (
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    <span style={{ color: quality.color }}>⭐ Quality: {quality.value}</span> |{' '}
                    <span style={{ color: difficulty.color }}>💪 Difficulty: {difficulty.value}</span>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
              <button
                onClick={() => onAddToPlanner(cls)}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
                disabled={plannedClasses.some(planned => planned.id === cls.id)}
              >
                {plannedClasses.some(planned => planned.id === cls.id) ? '✓ Added' : '+ Add'}
              </button>
              <button
                onClick={() => setShowSemesterSelector(cls)}
                style={{
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                🎯 Long Term Plan
              </button>
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

      {/* Semester Selector Modal */}
      {showSemesterSelector && (
        <Modal onClose={() => setShowSemesterSelector(null)}>
          <h2>Add to Long Term Plan</h2>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            <strong>{showSemesterSelector.code}</strong>: {showSemesterSelector.name}
          </p>
          <p style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
            Select a semester to add this course to your long term plan:
          </p>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '10px'
          }}>
            {availableSemesters.map(semester => {
              const classesInSemester = semesterPlans[semester.label] || [];
              const isAlreadyAdded = classesInSemester.some(cls => cls.id === showSemesterSelector.id);
              
              return (
                <button
                  key={semester.label}
                  onClick={() => handleAddToSemester(semester, showSemesterSelector)}
                  disabled={isAlreadyAdded}
                  style={{
                    padding: '15px',
                    backgroundColor: isAlreadyAdded ? '#ccc' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}
                >
                  {semester.label}
                  {isAlreadyAdded && <div style={{ fontSize: '12px', marginTop: '4px' }}>✓ Added</div>}
                </button>
              );
            })}
          </div>
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
            const avg = getClassAverageRatings(infoClass);
            if (!avg?.hasData) return null;

            const quality = formatRating(avg.avgQuality, 'quality');
            const difficulty = formatRating(avg.avgDifficulty, 'difficulty');

            return (
              <div style={{ marginTop: '10px' }}>
                <p><strong>RMP Ratings (Avg):</strong></p>
                <ul style={{ marginLeft: '20px' }}>
                  <li><strong>Quality:</strong> <span style={{ color: quality.color }}>{quality.value}</span></li>
                  <li><strong>Difficulty:</strong> <span style={{ color: difficulty.color }}>{difficulty.value}</span></li>
                </ul>
              </div>
            );
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
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                onAddToPlanner(infoClass);
                setInfoClass(null);
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
            <button
              onClick={() => {
                setShowSemesterSelector(infoClass);
                setInfoClass(null);
              }}
              style={{
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              🎯 Add to Long Term Plan
            </button>
          </div>
        </Modal>
      )}

      {/* Conflict Tooltip */}
      {hoveredConflict && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredConflict.x + 10}px`,
            top: `${hoveredConflict.y + 10}px`,
            backgroundColor: '#fff',
            border: '2px solid #ff4444',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10000,
            maxWidth: '300px',
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#ff4444', marginBottom: '8px' }}>
            ⚠️ Conflict Detected
          </div>
          <div style={{ fontSize: '14px', color: '#333' }}>
            This course conflicts with:
          </div>
          <ul style={{ margin: '8px 0 0 20px', fontSize: '13px', color: '#666' }}>
            {hoveredConflict.conflicts.map((conflict, idx) => (
              <li key={idx}>
                <strong>{conflict.code}</strong>: {conflict.name}
                {conflict.schedule && (
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    {Array.isArray(conflict.schedule.days) ? conflict.schedule.days.join(', ') : conflict.schedule.days}{' '}
                    {conflict.schedule.startTime} - {conflict.schedule.endTime}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchPage;