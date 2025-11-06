import React, { useState } from 'react';

const FourYearPlanner = ({ semesterPlans, onUpdateSemesterPlans, onSavePlan, year, takenCourses }) => {
  const [saving, setSaving] = useState(false);

  console.log('TAKENCOURSES', takenCourses);
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

  const semesters = getAvailableSemesters();

  // Merge taken courses with planned courses
  const getMergedSemesterPlans = () => {
    const merged = { ...semesterPlans };
    
    // Add taken courses to their respective semesters
    takenCourses.forEach(course => {
      if (course.term) {
        // Convert "Fall 2023" format to match semester labels
        const semesterLabel = course.term;
        
        if (!merged[semesterLabel]) {
          merged[semesterLabel] = [];
        }
        
        // Check if course is already in the semester plan
        const exists = merged[semesterLabel].some(cls => cls.code === course.courseCode);
        
        if (!exists) {
          // Add taken course to the semester
          merged[semesterLabel].push({
            id: course._id || `taken-${course.courseCode}`,
            code: course.courseCode,
            name: course.courseName,
            hours: course.credits || 3,
            grade: course.grade,
            isTaken: true
          });
        }
      }
    });
    
    return merged;
  };

  const mergedPlans = getMergedSemesterPlans();

  const removeClassFromSemester = (semester, classId) => {
    const updated = {
      ...semesterPlans,
      [semester]: (semesterPlans[semester] || []).filter(cls => cls.id !== classId)
    };
    onUpdateSemesterPlans(updated);
  };

  const getTotalCredits = (semester) => {
    const classes = mergedPlans[semester] || [];
    return classes.reduce((sum, cls) => sum + (cls.hours || 3), 0);
  };

  const handleSaveToDatabase = async () => {
    setSaving(true);
    try {
      const futureCourses = [];

      Object.entries(semesterPlans).forEach(([semester, classes]) => {
        const coursesWithSemester = classes.map(cls => ({
          ...cls,
          semester
        }));
        futureCourses.push(...coursesWithSemester);
      });

      await onSavePlan({
        pastCourses: [],
        futureCourses,
      });

      alert('4-year plan saved successfully!');
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate total planned credits
  const totalCredits = Object.values(mergedPlans).reduce((total, classes) => {
    return total + classes.reduce((sum, cls) => sum + (cls.hours || 3), 0);
  }, 0);

  const totalClasses = Object.values(mergedPlans).reduce((total, classes) => {
    return total + classes.length;
  }, 0);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2>Long Term Plan</h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '5px 0 0 0' }}>
            View and manage your course plan for the next 4 years • Starting Fall 2025
          </p>
        </div>
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
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {saving ? '💾 Saving...' : '💾 Save to Database'}
        </button>
      </div>

      {totalClasses === 0 && (
        <div style={{
          backgroundColor: '#e3f2fd',
          border: '2px solid #2196F3',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1976D2' }}>📅 Your 4-Year Plan is Empty</h3>
          <p style={{ margin: '0', color: '#666' }}>
            Go to the <strong>Search Classes</strong> page and click the <strong>🎯 4-Year Plan</strong> button 
            next to any course to add it to a semester!
          </p>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        {semesters.map(semester => {
          const classes = mergedPlans[semester.label] || [];
          const totalCredits = getTotalCredits(semester.label);

          return (
            <div
              key={semester.label}
              style={{
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: 'white',
                minHeight: '200px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                  {semester.label}
                  <span style={{ 
                    fontSize: '12px', 
                    marginLeft: '8px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#FF9800',
                    color: 'white'
                  }}>
                  {
                    (semester.term > currentSem.term && semester.year === currentSem.year) ||
                    (semester.year < currentSem.year)
                      ? '✅ Taken'
                      : (semester.term === currentSem.term && semester.year === currentSem.year)
                        ? '🟢 Current'
                        : '📅 Planned'
                  }

                  </span>
                </h3>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {classes.length} classes | {totalCredits} credits
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                {classes.length === 0 ? (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: '#999',
                    fontSize: '13px'
                  }}>
                    No classes planned yet
                  </div>
                ) : (
                  classes.map(cls => (
                    <div
                      key={cls.id}
                      style={{
                        backgroundColor: cls.isTaken ? '#E8F5E9' : '#FFF3E0',
                        border: cls.isTaken ? '1px solid #A5D6A7' : '1px solid #FFE0B2',
                        padding: '8px',
                        marginBottom: '8px',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold' }}>
                          {cls.code}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {cls.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#888' }}>
                          {cls.hours || 3} credits
                        </div>
                      </div>
                      {!cls.isTaken && (
                        <button
                          onClick={() => removeClassFromSemester(semester.label, cls.id)}
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
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Section */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <h3>Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          <div>
            <h4 style={{ marginBottom: '10px', color: '#FF9800' }}>📅 Total Planned</h4>
            <p style={{ margin: '5px 0' }}>Classes: <strong>{totalClasses}</strong></p>
            <p style={{ margin: '5px 0' }}>Credits: <strong>{totalCredits}</strong></p>
          </div>
          <div>
            <h4 style={{ marginBottom: '10px', color: '#2196F3' }}>📊 By Semester</h4>
            {semesters.map(semester => {
              const classes = mergedPlans[semester.label] || [];
              if (classes.length === 0) return null;
              return (
                <p key={semester.label} style={{ fontSize: '14px', margin: '5px 0' }}>
                  <strong>{semester.label}:</strong> {classes.length} classes, {getTotalCredits(semester.label)} credits
                </p>
              );
            })}
            {totalClasses === 0 && (
              <p style={{ fontSize: '14px', margin: '5px 0', color: '#999' }}>
                No classes planned yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FourYearPlanner;