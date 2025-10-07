import React, { useState, useEffect } from 'react'
import { fetchDegreeRequirements, fetchUserTakenCourses } from './api.jsx'

function DegreeAudit({ plannedClasses, major = 'Computer Science', userEmail }) {
  const [degreeData, setDegreeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null);
  const [takenCourses, setTakenCourses] = useState([]);


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
        // Set the takenCourses state here (you’ll need to add one)
        setTakenCourses(takenCourses);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
  
    loadData();
  }, [major, userEmail]);
  

  const calculateProgress = (category) => {
    const plannedCodes = plannedClasses.map(c => c.code)
    
    // Find matching courses from planned classes
    const matchingClasses = plannedClasses.filter(planned => {
      // Check if it's in the available classes list
      const isInAvailable = category.availableClasses.some(
        avail => avail.code === planned.code
      )
      
      if (isInAvailable) return true
      
      // For depth requirements (CS 3000+)
      if (category.name === "Computer Science Depth") {
        const courseNum = parseInt(planned.code.replace('CS ', ''))
        return !isNaN(courseNum) && courseNum >= 3000
      }
      
      // For open electives, count everything not already counted
      if (category.name === "Open Electives") {
        return true // All courses count as open electives
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
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading degree requirements...</p>
      </div>
    )
  }

  if (!degreeData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
          color: 'white',
          padding: '30px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 15px 0', fontSize: '24px' }}>⚠️ Degree Requirements Not Available</h2>
          <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
            Degree requirements for <strong>{major}</strong> are not currently available in our database.
          </p>
          <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
            Currently, only Computer Science degree requirements are available. 
            We're working on adding more majors!
          </p>
        </div>
        <div style={{
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <p style={{ margin: '0 0 10px 0', color: '#6c757d' }}>
            <strong>Available majors:</strong> Computer Science
          </p>
          <p style={{ margin: '0', color: '#6c757d', fontSize: '14px' }}>
            You can still use the course planner and search features for any major.
          </p>
        </div>
      </div>
    )
  }

  const totalEarned = plannedClasses.reduce((sum, c) => sum + (c.hours || 3), 0)
  const totalRequired = degreeData.categories.reduce((sum, cat) => sum + cat.requiredHours, 0)

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '30px',
        borderRadius: '12px',
        marginBottom: '30px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '32px' }}>🎓 Degree Audit</h1>
        <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', opacity: 0.9 }}>{degreeData.major}</h2>
        <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
          Catalog Year: {degreeData.catalogYear}
        </p>
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            Total Progress: {totalEarned} / {totalRequired} hours
          </div>
          <div style={{ 
            width: '100%', 
            height: '20px', 
            background: 'rgba(255,255,255,0.3)',
            borderRadius: '10px',
            marginTop: '10px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${Math.min((totalEarned / totalRequired) * 100, 100)}%`,
              height: '100%',
              background: '#4CAF50',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '20px' }}>
        {degreeData.categories.map((category, idx) => {
          const progress = calculateProgress(category)
          const percentComplete = Math.min((progress.earnedHours / category.requiredHours) * 100, 100)
          
          return (
            <div 
              key={idx}
              style={{
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '20px',
                background: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.2s',
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '15px'
              }}>
                <div>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '20px',
                    color: '#333'
                  }}>
                    {progress.isComplete ? '✅ ' : '⏳ '}
                    {category.name}
                  </h3>
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    color: '#666', 
                    fontSize: '14px' 
                  }}>
                    {category.description}
                  </p>
                </div>
                <div style={{ 
                  textAlign: 'right',
                  minWidth: '120px'
                }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold',
                    color: progress.isComplete ? '#4CAF50' : '#666'
                  }}>
                    {progress.earnedHours} / {category.requiredHours}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    hours
                  </div>
                  {category.minCourses && (
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                      {progress.earnedCourses} / {category.minCourses} courses
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ 
                width: '100%', 
                height: '12px', 
                background: '#f0f0f0',
                borderRadius: '6px',
                marginBottom: '15px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${percentComplete}%`,
                  height: '100%',
                  background: progress.isComplete 
                    ? '#4CAF50' 
                    : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Required Courses */}
              {category.availableClasses.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <h4 style={{ 
                    margin: '0 0 10px 0', 
                    fontSize: '16px',
                    color: '#333'
                  }}>
                    {category.moreClassesAvailable ? 'Example Courses:' : 'Required Courses:'}
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {category.availableClasses.map((cls, clsIdx) => {
                      const isTaken = progress.matchingClasses.some(
                        taken => taken.code === cls.code
                      )
                      
                      return (
                        <div 
                          key={clsIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px',
                            background: isTaken ? '#e8f5e9' : '#f9f9f9',
                            borderRadius: '6px',
                            border: `1px solid ${isTaken ? '#4CAF50' : '#e0e0e0'}`
                          }}
                        >
                          <div>
                            <span style={{ 
                              fontWeight: 'bold',
                              color: isTaken ? '#2e7d32' : '#333'
                            }}>
                              {isTaken ? '✓ ' : ''}{cls.code}
                            </span>
                            {cls.required && (
                              <span style={{ 
                                marginLeft: '8px',
                                fontSize: '11px',
                                background: '#ff9800',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '3px'
                              }}>
                                REQUIRED
                              </span>
                            )}
                          </div>
                          <div style={{ 
                            fontSize: '14px',
                            color: '#666'
                          }}>
                            {cls.hours} {cls.hours === 1 ? 'hour' : 'hours'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {category.moreClassesAvailable && (
                    <p style={{ 
                      marginTop: '10px',
                      fontSize: '13px',
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      * Additional courses available - check course catalog
                    </p>
                  )}
                </div>
              )}

              {/* Completed courses from this category */}
              {progress.matchingClasses.length > 0 && (
                <div style={{ 
                  marginTop: '15px',
                  padding: '12px',
                  background: '#f0f7ff',
                  borderRadius: '6px',
                  borderLeft: '4px solid #2196F3'
                }}>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '14px',
                    color: '#1976d2'
                  }}>
                    📚 Planned Courses ({progress.matchingClasses.length}):
                  </h4>
                  <div style={{ fontSize: '13px', color: '#555' }}>
                    {progress.matchingClasses.map(c => c.code).join(', ')}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ 
        marginTop: '30px',
        padding: '20px',
        background: '#fff3e0',
        borderRadius: '8px',
        border: '1px solid #ffb74d'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#e65100' }}>📋 Important Notes</h3>
        <ul style={{ margin: '0', paddingLeft: '20px', color: '#666' }}>
          <li>This audit is based on your planned classes in the planner.</li>
          <li>Add classes to your planner to see them reflected here.</li>
          <li>Some categories allow flexible course selection - consult your advisor.</li>
          <li>Prerequisites and co-requisites are not validated in this view.</li>
          <li>Official degree audits should be obtained from your academic advisor.</li>
        </ul>
      </div>
    </div>
  )
}

export default DegreeAudit