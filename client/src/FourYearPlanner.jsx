import React, { useState, useEffect } from 'react';

const FourYearPlanner = ({ allClasses, onSavePlan }) => {
  const [startYear, setStartYear] = useState(2024);
  const [currentSemester, setCurrentSemester] = useState('Fall 2024');
  const [semesterPlans, setSemesterPlans] = useState({});
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Generate 4 years of semesters
  const generateSemesters = () => {
    const semesters = [];
    const terms = ['Fall', 'Spring', 'Summer'];
    
    for (let i = 0; i < 4; i++) {
      const year = startYear + i;
      terms.forEach(term => {
        semesters.push(`${term} ${year}`);
      });
    }
    return semesters;
  };

  const semesters = generateSemesters();

  // Determine if a semester is in the past
  const isPastSemester = (semester) => {
    const [term, yearStr] = semester.split(' ');
    const year = parseInt(yearStr);
    const [currentTerm, currentYearStr] = currentSemester.split(' ');
    const currentYear = parseInt(currentYearStr);

    if (year < currentYear) return true;
    if (year > currentYear) return false;

    const termOrder = { 'Spring': 0, 'Summer': 1, 'Fall': 2 };
    return termOrder[term] < termOrder[currentTerm];
  };

  // Load saved data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fourYearPlan');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSemesterPlans(data.semesterPlans || {});
        setStartYear(data.startYear || 2024);
        setCurrentSemester(data.currentSemester || 'Fall 2024');
      } catch (error) {
        console.error('Error loading saved plan:', error);
      }
    }
  }, []);

  // Save to localStorage whenever plan changes
  useEffect(() => {
    const planData = {
      semesterPlans,
      startYear,
      currentSemester
    };
    localStorage.setItem('fourYearPlan', JSON.stringify(planData));
  }, [semesterPlans, startYear, currentSemester]);

  const addClassToSemester = (semester, classItem) => {
    setSemesterPlans(prev => ({
      ...prev,
      [semester]: [...(prev[semester] || []), classItem]
    }));
    setShowClassSelector(false);
    setSearchTerm('');
  };

  const removeClassFromSemester = (semester, classId) => {
    setSemesterPlans(prev => ({
      ...prev,
      [semester]: (prev[semester] || []).filter(cls => cls.id !== classId)
    }));
  };

  const getTotalCredits = (semester) => {
    const classes = semesterPlans[semester] || [];
    return classes.reduce((sum, cls) => sum + (cls.hours || 3), 0);
  };

  const handleSaveToDatabase = async () => {
    setSaving(true);
    try {
      // Separate past and future courses
      const pastCourses = [];
      const futureCourses = [];

      Object.entries(semesterPlans).forEach(([semester, classes]) => {
        const coursesWithSemester = classes.map(cls => ({
          ...cls,
          semester
        }));

        if (isPastSemester(semester)) {
          pastCourses.push(...coursesWithSemester);
        } else {
          futureCourses.push(...coursesWithSemester);
        }
      });

      // Save using the provided callback
      await onSavePlan({
        pastCourses,
        futureCourses,
        startYear,
        currentSemester
      });

      alert('4-year plan saved successfully!');
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // const filteredClasses = allClasses.filter(cls => 
  //   cls.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //   cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  // );
  const filteredClasses = allClasses;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>4-Year Semester Planner</h2>
        <div>
          <label style={{ marginRight: '10px' }}>
            Start Year:
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value))}
              style={{ marginLeft: '5px', padding: '5px', width: '80px' }}
            />
          </label>
          <label style={{ marginRight: '10px' }}>
            Current Semester:
            <select
              value={currentSemester}
              onChange={(e) => setCurrentSemester(e.target.value)}
              style={{ marginLeft: '5px', padding: '5px' }}
            >
              {semesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </label>
          <button
            onClick={handleSaveToDatabase}
            disabled={saving}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {saving ? '💾 Saving...' : '💾 Save to Database'}
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        {semesters.map(semester => {
          const isPast = isPastSemester(semester);
          const classes = semesterPlans[semester] || [];
          const totalCredits = getTotalCredits(semester);

          return (
            <div
              key={semester}
              style={{
                border: isPast ? '2px solid #2196F3' : '2px solid #FF9800',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: isPast ? '#E3F2FD' : '#FFF3E0',
                minHeight: '200px'
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                  {semester}
                  <span style={{ 
                    fontSize: '12px', 
                    marginLeft: '8px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: isPast ? '#2196F3' : '#FF9800',
                    color: 'white'
                  }}>
                    {isPast ? '📚 Past' : '📅 Future'}
                  </span>
                </h3>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {classes.length} classes | {totalCredits} credits
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                {classes.map(cls => (
                  <div
                    key={cls.id}
                    style={{
                      backgroundColor: 'white',
                      padding: '8px',
                      marginBottom: '8px',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{cls.code}</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {cls.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        {cls.hours || 3} credits
                      </div>
                    </div>
                    <button
                      onClick={() => removeClassFromSemester(semester, cls.id)}
                      style={{
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setSelectedSemester(semester);
                  setShowClassSelector(true);
                }}
                style={{
                  width: '100%',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                + Add Class
              </button>
            </div>
          );
        })}
      </div>

      {/* Class Selector Modal */}
      {showClassSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>Add Class to {selectedSemester}</h3>
            
            <input
              type="text"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />

            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {filteredClasses.length === 0 && (
                <p style={{ textAlign: 'center', color: '#666' }}>No classes found</p>
              )}
              {filteredClasses.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => addClassToSemester(selectedSemester, cls)}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {cls.code}: {cls.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {cls.professors?.join(', ')} | {cls.hours || 3} credits
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowClassSelector(false);
                setSearchTerm('');
              }}
              style={{
                marginTop: '15px',
                width: '100%',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '10px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <h3>Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ marginBottom: '10px', color: '#2196F3' }}>📚 Completed (Past)</h4>
            <p>Classes: {Object.entries(semesterPlans)
              .filter(([sem]) => isPastSemester(sem))
              .reduce((sum, [, classes]) => sum + classes.length, 0)}</p>
            <p>Credits: {Object.entries(semesterPlans)
              .filter(([sem]) => isPastSemester(sem))
              .reduce((sum, [, classes]) => sum + classes.reduce((s, c) => s + (c.hours || 3), 0), 0)}</p>
          </div>
          <div>
            <h4 style={{ marginBottom: '10px', color: '#FF9800' }}>📅 Planned (Future)</h4>
            <p>Classes: {Object.entries(semesterPlans)
              .filter(([sem]) => !isPastSemester(sem))
              .reduce((sum, [, classes]) => sum + classes.length, 0)}</p>
            <p>Credits: {Object.entries(semesterPlans)
              .filter(([sem]) => !isPastSemester(sem))
              .reduce((sum, [, classes]) => sum + classes.reduce((s, c) => s + (c.hours || 3), 0), 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FourYearPlanner;