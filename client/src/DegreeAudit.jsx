import React, { useState, useEffect } from 'react'
import { fetchDegreeRequirements, fetchUserTakenCourses } from './api.jsx'
import './colors.css'

function DegreeAudit({ plannedClasses, major = 'Computer Science', userEmail, semesterPlans = {} }) {
  const [degreeData, setDegreeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null);
  const [takenCourses, setTakenCourses] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCoursesModal, setShowCoursesModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
  
      try {
        const [degreeData, takenCourses] = await Promise.all([
          fetchDegreeRequirements(major),
          userEmail ? fetchUserTakenCourses(userEmail) : Promise.resolve([])
        ]);
  
        console.log('Degree requirements:', degreeData);
        console.log('Taken courses:', takenCourses);
  
        setDegreeData(degreeData);
        setTakenCourses(takenCourses);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
  
    loadData();
  }, [major, userEmail]);

  const toggleCategory = (categoryName) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const openCoursesModal = (category) => {
    setSelectedCategory(category);
    setShowCoursesModal(true);
  };

  const closeCoursesModal = () => {
    setShowCoursesModal(false);
    setSelectedCategory(null);
  };
  
  const calculateProgress = (category, allocatedCourses = new Set()) => {
    // Get all courses from 4-year plan (semesterPlans)
    const fourYearPlanCourses = Object.values(semesterPlans).flat().map(course => ({
      code: course.code,
      name: course.name,
      hours: course.hours || 3,
      isTaken: false,
      isFromFourYearPlan: true
    }));

    // Combine taken courses, planned courses, and 4-year plan courses
    const allCourses = [
      ...takenCourses.map(tc => ({ 
        code: tc.courseCode, 
        name: tc.courseName,
        hours: tc.hours || 3,
        isTaken: true,
        isFromFourYearPlan: false
      })),
      ...plannedClasses.map(pc => ({ 
        code: pc.code,
        name: pc.name,
        hours: pc.hours || 3,
        isTaken: false,
        isFromFourYearPlan: false
      })),
      ...fourYearPlanCourses
    ];

    // Remove duplicates (prefer taken over planned)
    const uniqueCourses = [];
    const seenCodes = new Set();
    
    for (const course of allCourses) {
      if (!seenCodes.has(course.code)) {
        uniqueCourses.push(course);
        seenCodes.add(course.code);
      }
    }
    
    // Find matching courses that haven't been allocated yet
    const matchingClasses = uniqueCourses.filter(course => {
      // Skip if already allocated to another category
      if (allocatedCourses.has(course.code)) return false;
      
      // Check if it's in the available classes list
      const isInAvailable = category.availableClasses.some(
        avail => avail.code === course.code
      )
      
      if (isInAvailable) return true
      
      // For depth requirements (CS 3000+)
      if (category.name === "Computer Science Depth") {
        const courseNum = parseInt(course.code.replace('CS ', ''))
        return !isNaN(courseNum) && courseNum >= 3000
      }
      
      // For open electives, count everything not already counted
      if (category.name === "Open Electives") {
        return true
      }
      
      return false
    })
    
    const earnedHours = matchingClasses.reduce((sum, c) => sum + (c.hours || 3), 0)
    const earnedCourses = matchingClasses.length
    
    return {
      earnedHours,
      earnedCourses,
      matchingClasses,
      isComplete: earnedHours >= category.requiredHours
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ 
          fontSize: '18px', 
          color: '#666',
          margin: 0
        }}>Loading your degree requirements...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!degreeData) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
          color: 'white',
          padding: '40px',
          borderRadius: '16px',
          marginBottom: '30px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '28px', fontWeight: '600' }}>
            Degree Requirements Not Available
          </h2>
          <p style={{ margin: '0 0 15px 0', fontSize: '18px', opacity: 0.9 }}>
            Degree requirements for <strong>{major}</strong> are not currently available in our database.
          </p>
          <p style={{ margin: '0', fontSize: '16px', opacity: 0.8 }}>
            Currently, only Computer Science degree requirements are available. 
            We're working on adding more majors!
          </p>
        </div>
        
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
          boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '20px' }}>
            📚 Available Features
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#4CAF50', fontSize: '20px' }}>✅</span>
              <span style={{ color: '#666' }}>Course search and filtering for any major</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#4CAF50', fontSize: '20px' }}>✅</span>
              <span style={{ color: '#666' }}>Semester planning and calendar view</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#4CAF50', fontSize: '20px' }}>✅</span>
              <span style={{ color: '#666' }}>RateMyProfessor integration</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#ff9800', fontSize: '20px' }}>⚠️</span>
              <span style={{ color: '#666' }}>Degree audit available for Computer Science only</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Calculate total from all sources
  const totalEarned = [
    ...takenCourses.map(tc => tc.hours || 3),
    ...plannedClasses.map(pc => pc.hours || 3),
    ...Object.values(semesterPlans).flat().map(course => course.hours || 3)
  ].reduce((sum, hours) => sum + hours, 0);
  
  const totalRequired = degreeData.categories.reduce((sum, cat) => sum + cat.requiredHours, 0)
  const overallProgress = Math.min((totalEarned / totalRequired) * 100, 100)

  return (
    <div style={{ 
      padding: '24px', 
      maxWidth: '1400px', 
      margin: '0 auto',
      background: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* Header Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '40px',
        borderRadius: '20px',
        marginBottom: '32px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '-30px',
          width: '150px',
          height: '150px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '50%'
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '48px' }}>🎓</div>
            <div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '36px', fontWeight: '700' }}>
                Degree Audit
              </h1>
              <h2 style={{ margin: '0', fontSize: '24px', opacity: 0.9, fontWeight: '400' }}>
                {degreeData.major}
              </h2>
            </div>
          </div>
          
          <p style={{ margin: '0 0 24px 0', fontSize: '16px', opacity: 0.8 }}>
            Catalog Year: {degreeData.catalogYear}
          </p>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                  Overall Progress
                </div>
                <div style={{ fontSize: '18px', opacity: 0.9 }}>
                  {totalEarned} of {totalRequired} credit hours
                </div>
              </div>
              <div style={{ 
                fontSize: '32px', 
                fontWeight: '700',
                background: 'rgba(255,255,255,0.2)',
                padding: '12px 20px',
                borderRadius: '12px'
              }}>
                {Math.round(overallProgress)}%
              </div>
            </div>
            
            <div style={{ 
              width: '100%', 
              height: '12px', 
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${overallProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4CAF50 0%, #45a049 100%)',
                transition: 'width 0.8s ease',
                borderRadius: '6px'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
            {/* Categories Grid */}
            <div style={{ 
        display: 'grid', 
        gap: '24px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))'
      }}>
        {(() => {
          // ✅ Shared allocation tracker to prevent double-counting
          const allocatedCourses = new Set();

          return degreeData.categories.map((category, idx) => {
            // Pass the shared allocatedCourses set
            const progress = calculateProgress(category, allocatedCourses);

            // Mark matched courses as used so they aren’t reused
            progress.matchingClasses.forEach(c => allocatedCourses.add(c.code));

            const percentComplete = Math.min(
              (progress.earnedHours / category.requiredHours) * 100,
              100
            );
            const isExpanded = expandedCategories.has(category.name);

            return (
              <div 
                key={idx}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  border: progress.isComplete ? '2px solid #4CAF50' : '2px solid transparent'
                }}
              >
                {/* Category Header */}
                <div 
                  style={{
                    padding: '24px',
                    cursor: 'pointer',
                    background: progress.isComplete 
                      ? 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)'
                      : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                    borderBottom: '1px solid #e9ecef'
                  }}
                  onClick={() => toggleCategory(category.name)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '24px' }}>
                          {progress.isComplete ? '✅' : '📚'}
                        </div>
                        <h3 style={{ 
                          margin: '0', 
                          fontSize: '20px',
                          color: '#2d3748',
                          fontWeight: '600'
                        }}>
                          {category.name}
                        </h3>
                      </div>
                      <p style={{ 
                        margin: '0 0 16px 0', 
                        color: '#718096', 
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }}>
                        {category.description}
                      </p>
                      
                      {/* Progress Bar */}
                      <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        background: '#e2e8f0',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '12px'
                      }}>
                        <div style={{ 
                          width: `${percentComplete}%`,
                          height: '100%',
                          background: progress.isComplete 
                            ? 'linear-gradient(90deg, #4CAF50 0%, #45a049 100%)'
                            : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                          transition: 'width 0.6s ease'
                        }} />
                      </div>
                    </div>
                    
                    <div style={{ 
                      textAlign: 'right',
                      minWidth: '100px',
                      marginLeft: '20px'
                    }}>
                      <div style={{ 
                        fontSize: '28px', 
                        fontWeight: '700',
                        color: progress.isComplete ? '#2e7d32' : '#4a5568',
                        marginBottom: '4px'
                      }}>
                        {progress.earnedHours}/{category.requiredHours}
                      </div>
                      <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: '500' }}>
                        CREDIT HOURS
                      </div>
                      {category.minCourses && (
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#718096', 
                          marginTop: '8px',
                          padding: '4px 8px',
                          background: '#f7fafc',
                          borderRadius: '6px'
                        }}>
                          {progress.earnedCourses}/{category.minCourses} courses
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: '16px'
                  }}>
                    <div style={{ 
                      fontSize: '14px', 
                      color: progress.isComplete ? '#2e7d32' : '#4a5568',
                      fontWeight: '500'
                    }}>
                      {progress.isComplete ? '✅ Complete' : `${Math.round(percentComplete)}% Complete`}
                    </div>
                    
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {category.availableClasses.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCoursesModal(category);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          📋 View Courses ({category.availableClasses.length})
                        </button>
                      )}
                      
                      {progress.matchingClasses.length > 0 && (() => {
                        const takenCount = progress.matchingClasses.filter(c => c.isTaken).length;
                        const plannedCount = progress.matchingClasses.filter(c => !c.isTaken).length;
                        
                        const parts = [];
                        if (takenCount > 0) parts.push(`${takenCount} taken`);
                        if (plannedCount > 0) parts.push(`${plannedCount} planned`);
                        
                        return (
                          <div style={{ 
                            fontSize: '12px',
                            color: '#4a5568',
                            background: '#f7fafc',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}>
                            {parts.join(', ')}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Footer Notes */}
      <div style={{ 
        marginTop: '40px',
        padding: '24px',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #e9ecef'
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0', 
          color: '#2d3748',
          fontSize: '18px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📋 Important Information
        </h3>
        <div style={{ 
          display: 'grid', 
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ color: '#4CAF50', fontSize: '16px', marginTop: '2px' }}>💡</span>
            <span style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.5' }}>
              This audit reflects courses from your planner and 4-year plan
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ color: '#4CAF50', fontSize: '16px', marginTop: '2px' }}>➕</span>
            <span style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.5' }}>
              Add classes to your planner or 4-year plan to see them reflected here
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ color: '#ff9800', fontSize: '16px', marginTop: '2px' }}>⚠️</span>
            <span style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.5' }}>
              Some categories allow flexible course selection - consult your advisor
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ color: '#ff9800', fontSize: '16px', marginTop: '2px' }}>📚</span>
            <span style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.5' }}>
              Prerequisites and co-requisites are not validated in this view
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ color: '#2196F3', fontSize: '16px', marginTop: '2px' }}>🎓</span>
            <span style={{ color: '#4a5568', fontSize: '14px', lineHeight: '1.5' }}>
              Official degree audits should be obtained from your academic advisor
            </span>
          </div>
        </div>
      </div>

      {/* Courses Modal - Same as before */}
      {showCoursesModal && selectedCategory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e9ecef',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600' }}>
                    📋 {selectedCategory.name}
                  </h2>
                  <p style={{ margin: '0', fontSize: '16px', opacity: 0.9 }}>
                    {selectedCategory.moreClassesAvailable ? 'Example Courses' : 'Required Courses'}
                  </p>
                </div>
                <button
                  onClick={closeCoursesModal}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '24px',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}>
              <div style={{ 
                display: 'grid', 
                gap: '16px',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
              }}>
                {selectedCategory.availableClasses.map((cls, clsIdx) => {
                  const progress = calculateProgress(selectedCategory);
                  const matchedCourse = progress.matchingClasses.find(
                    taken => taken.code === cls.code
                  );
                  const isTaken = !!matchedCourse;
                  
                  return (
                    <div 
                      key={clsIdx}
                      style={{
                        padding: '20px',
                        background: isTaken ? '#f0fff4' : '#f8fafc',
                        borderRadius: '12px',
                        border: `2px solid ${isTaken ? '#4CAF50' : '#e2e8f0'}`,
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ 
                              fontWeight: '600',
                              color: isTaken ? '#2e7d32' : '#2d3748',
                              fontSize: '18px'
                            }}>
                              {cls.code}
                            </span>
                            {isTaken && (
                              <span style={{ 
                                fontSize: '18px',
                                color: '#4CAF50'
                              }}>✓</span>
                            )}
                            {cls.required && (
                              <span style={{ 
                                fontSize: '10px',
                                background: '#ff9800',
                                color: 'white',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: '600',
                                textTransform: 'uppercase'
                              }}>
                                Required
                              </span>
                            )}
                          </div>
                          <div style={{ 
                            fontSize: '14px',
                            color: '#718096',
                            marginBottom: '8px',
                            lineHeight: '1.4'
                          }}>
                            {cls.hours} {cls.hours === 1 ? 'credit hour' : 'credit hours'}
                          </div>
                        </div>
                      </div>
                      
                      {isTaken && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: matchedCourse.isTaken ? '#2196F3' : matchedCourse.isFromFourYearPlan ? '#FF9800' : '#4CAF50',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {matchedCourse.isTaken ? 'TAKEN' : matchedCourse.isFromFourYearPlan ? '4-YEAR PLAN' : 'PLANNED'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {selectedCategory.moreClassesAvailable && (
                <div style={{ 
                  marginTop: '24px',
                  padding: '16px',
                  background: '#fff3cd',
                  borderRadius: '12px',
                  border: '1px solid #ffeaa7'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>💡</span>
                    <h4 style={{ margin: '0', fontSize: '16px', color: '#856404', fontWeight: '600' }}>
                      Additional Courses Available
                    </h4>
                  </div>
                  <p style={{ 
                    margin: '0',
                    fontSize: '14px',
                    color: '#856404',
                    lineHeight: '1.5'
                  }}>
                    The courses shown above are examples. Additional courses may be available to fulfill this requirement. 
                    Please check the course catalog or consult with your academic advisor for the complete list of options.
                  </p>
                </div>
              )}

              {(() => {
                const progress = calculateProgress(selectedCategory);
                if (progress.matchingClasses.length > 0) {
                  return (
                    <div style={{ 
                      marginTop: '24px',
                      padding: '20px',
                      background: 'linear-gradient(135deg, #e6f3ff 0%, #f0f8ff 100%)',
                      borderRadius: '12px',
                      border: '1px solid #b3d9ff'
                    }}>
                      <h4 style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: '18px',
                        color: '#1976d2',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        🎯 Your Progress ({progress.matchingClasses.length} courses)
                      </h4>
                      <div style={{ 
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        {progress.matchingClasses.map((course, courseIdx) => (
                          <span 
                            key={courseIdx}
                            style={{
                              background: course.isTaken ? '#e8f5e9' : course.isFromFourYearPlan ? '#fff3e0' : '#f3e5f5',
                              color: course.isTaken ? '#2e7d32' : course.isFromFourYearPlan ? '#e65100' : '#6a1b9a',
                              padding: '8px 12px',
                              borderRadius: '20px',
                              fontSize: '14px',
                              fontWeight: '500',
                              border: `1px solid ${course.isTaken ? '#4CAF50' : course.isFromFourYearPlan ? '#ffb74d' : '#ce93d8'}`
                            }}
                          >
                            {course.isTaken ? '✓ ' : course.isFromFourYearPlan ? '🎯 ' : '📅 '}{course.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #e9ecef',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={closeCoursesModal}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DegreeAudit