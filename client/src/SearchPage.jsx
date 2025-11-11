import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal.jsx';
import { getClassAverageRatings, formatRating, fetchDegreeRequirements } from './api.jsx';

// Helper function to get time frame from schedule
const getTimeFrame = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  
  // Parse time - handle formats like "11:15" or "11:15AM"
  const parseTime = (timeStr) => {
    const cleanTime = timeStr.replace(/[ap]m?/i, '').trim();
    const [hour, min] = cleanTime.split(':').map(Number);
    let hour24 = hour;
    
    if (timeStr.toLowerCase().includes('p') && hour !== 12) {
      hour24 = hour + 12;
    } else if (timeStr.toLowerCase().includes('a') && hour === 12) {
      hour24 = 0;
    }
    
    return hour24 * 60 + (min || 0); // Return minutes from midnight
  };
  
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  const midMinutes = (startMinutes + endMinutes) / 2;
  
  // Define time frames
  if (midMinutes >= 8 * 60 && midMinutes < 12 * 60) {
    return 'Morning (8:00 AM - 12:00 PM)';
  } else if (midMinutes >= 12 * 60 && midMinutes < 17 * 60) {
    return 'Afternoon (12:00 PM - 5:00 PM)';
  } else if (midMinutes >= 17 * 60 && midMinutes < 22 * 60) {
    return 'Evening (5:00 PM - 10:00 PM)';
  } else {
    return 'Other';
  }
};

const SearchPage = ({ 
  allClasses, 
  plannedClasses, 
  onAddToPlanner, 
  usingMockData, 
  onRefreshData,
  semesterPlans = {},
  onAddToSemester,
  userMajor = 'Computer Science',
  year
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [infoClass, setInfoClass] = useState(null);
  const [showSemesterSelector, setShowSemesterSelector] = useState(null);
  const [hoveredConflict, setHoveredConflict] = useState(null);
  const [expandedFilters, setExpandedFilters] = useState({});
  const [filterSearch, setFilterSearch] = useState({});
  const [degreeRequirements, setDegreeRequirements] = useState(null);
  const [courseCategoryMap, setCourseCategoryMap] = useState({});

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

  const currentSem = { term: 'Fall', year: 2025, label: 'Fall 2025' }

  // Get current and future semesters (no summer, chronologically ordered)
  // Hardcoded to start from Fall 2025
  const getAvailableSemesters = () => {
    const semesters = [];
    let startYear = 2025;

    let yearAdj = 0
    
    switch (year) {
      case 'Freshman': yearAdj=0
      case 'Sophomore': yearAdj=1
      case 'Junior': yearAdj=2
      case 'Senior': yearAdj=3
    }
    startYear = startYear - yearAdj

    // Start with Fall 2025
    semesters.push({ term: 'Fall', year: startYear, label: 'Fall ' + startYear });
    
    // Generate next 4 years of semesters (Spring and Fall only)
    for (let i = 1; i < 8; i++) { // 8 semesters = 4 years
      const year = startYear + Math.floor((i+1) / 2);
      const term = i % 2 === 1 ? 'Spring' : 'Fall';
      semesters.push({ term, year, label: `${term} ${year}` });
    }
    
    return semesters;
  };

  const availableSemesters = getAvailableSemesters();

  // Fetch degree requirements and build category mapping
  useEffect(() => {
    const loadDegreeRequirements = async () => {
      try {
        const degreeData = await fetchDegreeRequirements(userMajor);
        setDegreeRequirements(degreeData);
        
        // Build a map of course codes to categories
        const categoryMap = {};
        if (degreeData && degreeData.categories) {
          degreeData.categories.forEach((category) => {
            const categoryName = category.name;
            
            // Add courses from availableClasses
            if (category.availableClasses && Array.isArray(category.availableClasses)) {
              category.availableClasses.forEach((course) => {
                if (course.code) {
                  // Normalize course code - handle variations like "CS 1101" vs "CS1101"
                  const code = course.code.toUpperCase().trim().replace(/\s+/g, ' ');
                  // Store both with space and without space for matching
                  if (!categoryMap[code]) {
                    categoryMap[code] = new Set();
                  }
                  categoryMap[code].add(categoryName);
                  
                  // Also store without space
                  const codeNoSpace = code.replace(/\s+/g, '');
                  if (codeNoSpace !== code) {
                    if (!categoryMap[codeNoSpace]) {
                      categoryMap[codeNoSpace] = new Set();
                    }
                    categoryMap[codeNoSpace].add(categoryName);
                  }
                }
              });
            }
          });
        }
        
        // Convert Sets to Arrays for easier use
        const categoryMapArrays = {};
        Object.keys(categoryMap).forEach((code) => {
          categoryMapArrays[code] = Array.from(categoryMap[code]);
        });
        setCourseCategoryMap(categoryMapArrays);
      } catch (error) {
        console.error('Error loading degree requirements:', error);
      }
    };
    
    loadDegreeRequirements();
  }, [userMajor]);

  // Get degree category for a course
  const getCourseCategories = (course) => {
    const categories = new Set();
    
    if (!degreeRequirements || !degreeRequirements.categories) {
      return Array.from(categories);
    }
    
    const courseCode = course.code?.toUpperCase().trim();
    if (!courseCode) return Array.from(categories);
    
    // Normalize course code (remove spaces, handle variations like "CS1101" vs "CS 1101")
    const normalizedCode = courseCode.replace(/\s+/g, ' ');
    
    // Check direct mapping (try both with and without spaces)
    if (courseCategoryMap[normalizedCode]) {
      courseCategoryMap[normalizedCode].forEach((cat) => categories.add(cat));
    }
    
    // Also check without spaces
    const codeNoSpaces = normalizedCode.replace(/\s+/g, '');
    if (courseCategoryMap[codeNoSpaces]) {
      courseCategoryMap[codeNoSpaces].forEach((cat) => categories.add(cat));
    }
    
    // Check special categories
    degreeRequirements.categories.forEach((category) => {
      if (category.name === 'Computer Science Depth') {
        // Check if it's a CS 3000+ course
        const match = normalizedCode.match(/^CS\s*(\d+)/);
        if (match) {
          const courseNum = parseInt(match[1]);
          if (!isNaN(courseNum) && courseNum >= 3000) {
            categories.add(category.name);
          }
        }
      }
      // Note: Open Electives can include any course, but we don't auto-add it
      // to avoid cluttering. Users can still filter by it if needed.
    });
    
    return Array.from(categories);
  };

  // Only include specific filterable keys
  const allowedFilterKeys = ['active', 'subject', 'professors', 'sectionType', 'schedule', 'days', 'degreeCategory'];

  const filterableKeys = useMemo(() => {
    if (allClasses.length === 0) return [];
    // For 'days' and 'schedule', we'll always include them if classes have schedule data
    const hasSchedule = allClasses.some(cls => cls.schedule);
    const baseKeys = ['active', 'subject', 'professors', 'sectionType'];
    if (hasSchedule) {
      baseKeys.push('schedule', 'days');
    }
    // Add degreeCategory if we have degree requirements
    if (degreeRequirements && degreeRequirements.categories) {
      baseKeys.push('degreeCategory');
    }
    // Only return keys that exist in the data and are in our allowed list
    const availableKeys = Object.keys(allClasses[0]);
    return baseKeys.filter(key => {
      if (key === 'days' || key === 'schedule' || key === 'degreeCategory') {
        if (key === 'days' || key === 'schedule') return hasSchedule;
        if (key === 'degreeCategory') return degreeRequirements && degreeRequirements.categories;
        return false;
      }
      return availableKeys.includes(key);
    });
  }, [allClasses, degreeRequirements]);

  const attributeOptions = useMemo(() => {
    const options = {};
    
    filterableKeys.forEach((key) => {
      if (key === 'degreeCategory') {
        // Special handling for degree category - get all categories from degree requirements
        if (degreeRequirements && degreeRequirements.categories) {
          const categories = degreeRequirements.categories.map(cat => cat.name);
          options[key] = categories.sort();
        } else {
          options[key] = [];
        }
      } else if (key === 'schedule') {
        // Special handling for schedule - create time frame options
        const timeFramesSet = new Set();
        allClasses.forEach((cls) => {
          if (cls.schedule && cls.schedule.startTime && cls.schedule.endTime) {
            const timeFrame = getTimeFrame(cls.schedule.startTime, cls.schedule.endTime);
            if (timeFrame) {
              timeFramesSet.add(timeFrame);
            }
          }
        });
        options[key] = Array.from(timeFramesSet).sort();
      } else if (key === 'days') {
        // Special handling for days - extract from schedule.days
        const daysSet = new Set();
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        allClasses.forEach((cls) => {
          if (cls.schedule && cls.schedule.days) {
            const days = Array.isArray(cls.schedule.days) ? cls.schedule.days : [cls.schedule.days];
            days.forEach((day) => {
              if (day) {
                daysSet.add(day);
              }
            });
          }
        });
        // Sort days in order: Monday through Sunday
        options[key] = Array.from(daysSet).sort((a, b) => {
          const indexA = dayOrder.indexOf(a);
          const indexB = dayOrder.indexOf(b);
          if (indexA === -1 && indexB === -1) return a.localeCompare(b);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      } else if (key === 'professors') {
        // Handle professors array
        const professorsSet = new Set();
        allClasses.forEach((cls) => {
          if (Array.isArray(cls.professors)) {
            cls.professors.forEach((prof) => professorsSet.add(prof));
          } else if (cls.professors) {
            professorsSet.add(cls.professors);
          }
        });
        options[key] = Array.from(professorsSet).sort();
      } else {
        // Handle other fields normally
        const valuesSet = new Set();
      allClasses.forEach((cls) => {
        const val = cls[key];
          if (val !== null && val !== undefined) {
        if (Array.isArray(val)) {
          val.forEach((v) => valuesSet.add(v));
        } else {
          valuesSet.add(val);
            }
        }
      });
        options[key] = Array.from(valuesSet).sort();
      }
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

  // Get count of active filters
  const getActiveFilterCount = () => {
    return Object.values(selectedFilters).reduce((count, filterSet) => {
      return count + (filterSet ? filterSet.size : 0);
    }, 0);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedFilters({});
  };

  // Toggle filter section expansion
  const toggleFilterSection = (key) => {
    setExpandedFilters((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false, // Toggle: undefined/true -> false, false -> true
    }));
  };

  // Format filter key for display
  const formatFilterKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Filter options by search term
  const getFilteredOptions = (key) => {
    const options = attributeOptions[key] || [];
    const search = filterSearch[key] || '';
    if (!search) return options;
    return options.filter((opt) =>
      String(opt).toLowerCase().includes(search.toLowerCase())
    );
  };

  const filteredClasses = allClasses.filter((cls) => {
    const searchMatch =
      cls.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!searchMatch) return false;

    for (const key of filterableKeys) {
      const selectedValues = selectedFilters[key];
      if (!selectedValues || selectedValues.size === 0) continue;

      if (key === 'degreeCategory') {
        // Special handling for degree category - check if course belongs to selected categories
        const courseCategories = getCourseCategories(cls);
        if (courseCategories.length === 0 || !courseCategories.some((cat) => selectedValues.has(cat))) {
          return false;
        }
      } else if (key === 'schedule') {
        // Special handling for schedule - check time frame
        if (!cls.schedule || !cls.schedule.startTime || !cls.schedule.endTime) {
          return false;
        }
        const timeFrame = getTimeFrame(cls.schedule.startTime, cls.schedule.endTime);
        if (!timeFrame || !selectedValues.has(timeFrame)) {
          return false;
        }
      } else if (key === 'days') {
        // Special handling for days - check if class meets on any selected day
        if (!cls.schedule || !cls.schedule.days) {
          return false;
        }
        const clsDays = Array.isArray(cls.schedule.days) ? cls.schedule.days : [cls.schedule.days];
        if (!clsDays.some((day) => selectedValues.has(day))) {
          return false;
        }
      } else if (key === 'professors') {
        // Handle professors array
        const clsProfessors = Array.isArray(cls.professors) ? cls.professors : (cls.professors ? [cls.professors] : []);
        if (!clsProfessors.some((prof) => selectedValues.has(prof))) {
          return false;
        }
      } else {
        // Handle other fields normally
      const clsVal = cls[key];
      if (Array.isArray(clsVal)) {
        if (!clsVal.some((v) => selectedValues.has(v))) return false;
      } else {
        if (!selectedValues.has(clsVal)) return false;
        }
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

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
      <button
        onClick={() => setShowFilter(true)}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          🔍 Filters
          {getActiveFilterCount() > 0 && (
            <span style={{
              backgroundColor: '#ff4444',
              color: 'white',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {getActiveFilterCount()}
            </span>
          )}
        </button>
        {getActiveFilterCount() > 0 && (
          <button
            onClick={clearAllFilters}
            style={{
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Clear All
      </button>
        )}
      </div>

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
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              paddingRight: '32px', // Add padding to avoid overlap with modal close button
              borderBottom: '2px solid #e0e0e0',
              position: 'relative'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', color: '#333', flex: 1 }}>🔍 Filter Courses</h2>
              <button
                onClick={clearAllFilters}
                style={{
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  flexShrink: 0,
                  marginLeft: '12px'
                }}
                disabled={getActiveFilterCount() === 0}
              >
                Clear All ({getActiveFilterCount()})
              </button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
              {filterableKeys.map((key) => {
                const isExpanded = expandedFilters[key] !== false; // Default to expanded (undefined = true)
                const options = getFilteredOptions(key);
                const activeCount = selectedFilters[key]?.size || 0;
                const totalCount = attributeOptions[key]?.length || 0;

                return (
                  <div
                    key={key}
                    style={{
                      marginBottom: '20px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#fafafa'
                    }}
                  >
                    {/* Filter Header */}
                    <div
                      onClick={() => toggleFilterSection(key)}
                      style={{
                        padding: '16px',
                        backgroundColor: activeCount > 0 ? '#e3f2fd' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none',
                        position: 'relative',
                        minHeight: '48px',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        <strong style={{ fontSize: '16px', color: '#333', flexShrink: 0 }}>
                          {formatFilterKey(key)}
                        </strong>
                        {activeCount > 0 && (
                          <span style={{
                            backgroundColor: '#2196F3',
                            color: 'white',
                            borderRadius: '12px',
                            padding: '2px 8px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {activeCount} selected
                          </span>
                        )}
                      </div>
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#666',
                        flexShrink: 0,
                        marginLeft: '12px',
                        whiteSpace: 'nowrap'
                      }}>
                        {totalCount} options
                      </span>
                    </div>

                    {/* Filter Options */}
                    {isExpanded && (
                      <div style={{ padding: '16px', backgroundColor: '#fff' }}>
                        {/* Search within filter */}
                        {(attributeOptions[key]?.length || 0) > 5 && (
                          <input
                            type="text"
                            placeholder={`Search ${formatFilterKey(key).toLowerCase()}...`}
                            value={filterSearch[key] || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              setFilterSearch((prev) => ({
                                ...prev,
                                [key]: e.target.value
                              }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '10px',
                              marginBottom: '12px',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              fontSize: '14px',
                              boxSizing: 'border-box'
                            }}
                          />
                        )}

                        {/* Options Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                          gap: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          padding: '4px'
                        }}>
                          {options.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', color: '#999', fontStyle: 'italic' }}>
                              No options found
                            </div>
                          ) : (
                            options.map((option) => {
                              const isSelected = selectedFilters[key]?.has(option) || false;
                              return (
                                <label
                                  key={option}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '10px 12px',
                                    border: `2px solid ${isSelected ? '#2196F3' : '#ddd'}`,
                                    borderRadius: '6px',
                                    backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '14px',
                                    fontWeight: isSelected ? '500' : '400'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = '#2196F3';
                                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.borderColor = '#ddd';
                                      e.currentTarget.style.backgroundColor = '#fff';
                                    }
                                  }}
                                >
                    <input
                      type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleFilter(key, option);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      marginRight: '8px',
                                      cursor: 'pointer',
                                      width: '18px',
                                      height: '18px',
                                      flexShrink: 0
                                    }}
                    />
                                  <span style={{ flex: 1 }}>{String(option)}</span>
                                  {isSelected && (
                                    <span style={{ color: '#2196F3', fontSize: '16px', flexShrink: 0 }}>✓</span>
                                  )}
                  </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '2px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {getActiveFilterCount() > 0 ? (
                  <span>
                    <strong>{getActiveFilterCount()}</strong> filter{getActiveFilterCount() !== 1 ? 's' : ''} active
                  </span>
                ) : (
                  <span>No filters applied</span>
                )}
              </div>
              <button
                onClick={() => setShowFilter(false)}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 24px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Apply Filters
              </button>
            </div>
          </div>
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