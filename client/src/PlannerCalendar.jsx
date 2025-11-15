// PlannerCalendar.js - Updated to use new semester planner endpoint

import React, { useState, useEffect } from 'react';
import { saveSemesterPlanner } from './api.jsx';

function PlannerCalendar({ plannedClasses, onRemoveClass, onSavePlan, readOnly = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null

  const timeSlots = [];
  for (let hour = 8; hour <= 18; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Calculate time in minutes from 8:00 AM (start of calendar)
  const timeToMinutes = (time) => {
    const [hour, min] = time.split(':').map(Number);
    return (hour * 60 + min) - (8 * 60); // Subtract 8:00 AM (480 minutes)
  };

  // Get all classes for a specific day
  const getClassesForDay = (day) => {
    return plannedClasses.filter(cls => {
      if (!cls.schedule || !cls.schedule.days || !cls.schedule.startTime || !cls.schedule.endTime) {
        return false;
      }
      
      const classDays = Array.isArray(cls.schedule.days) ? cls.schedule.days : [cls.schedule.days];
      return classDays.includes(day);
    });
  };

  // Calculate position and height for a course block
  const getCourseBlockStyle = (cls) => {
    const startTime = cls.schedule.startTime;
    const endTime = cls.schedule.endTime;
    
    // Parse times - handle format like "11:15" or "11:15AM"
    let startHour, startMin, endHour, endMin;
    
    // Clean time string (remove AM/PM if present)
    const cleanStartTime = startTime.replace(/[ap]m?/i, '').trim();
    const cleanEndTime = endTime.replace(/[ap]m?/i, '').trim();
    
    // Parse hour and minute
    const startParts = cleanStartTime.split(':');
    const endParts = cleanEndTime.split(':');
    
    startHour = parseInt(startParts[0], 10);
    startMin = parseInt(startParts[1] || '0', 10);
    endHour = parseInt(endParts[0], 10);
    endMin = parseInt(endParts[1] || '0', 10);
    
    // Handle 12-hour format if needed (check if original string had AM/PM)
    if (startTime.toLowerCase().includes('p') && startHour !== 12) {
      startHour += 12;
    } else if (startTime.toLowerCase().includes('a') && startHour === 12) {
      startHour = 0;
    }
    if (endTime.toLowerCase().includes('p') && endHour !== 12) {
      endHour += 12;
    } else if (endTime.toLowerCase().includes('a') && endHour === 12) {
      endHour = 0;
    }
    
    // Convert to minutes from midnight
    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    
    // Calculate minutes from 8:00 AM (calendar start)
    const calendarStartMinutes = 8 * 60; // 8:00 AM = 480 minutes
    const startMinutesFromCalendar = startTotalMinutes - calendarStartMinutes;
    const endMinutesFromCalendar = endTotalMinutes - calendarStartMinutes;
    
    const duration = endMinutesFromCalendar - startMinutesFromCalendar;
    
    // Each 30-minute slot is 30px high
    const slotHeight = 30;
    
    // Calculate top position in pixels - each 30-minute slot is 30px
    const top = (startMinutesFromCalendar / 30) * slotHeight;
    const height = (duration / 30) * slotHeight;
    
    // Ensure minimum height for visibility
    const minHeight = Math.max(height, 20);
    
    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Course ${cls.code}: ${startTime} - ${endTime}`, {
        parsed: `${startHour}:${startMin} - ${endHour}:${endMin}`,
        startMinutesFromCalendar,
        endMinutesFromCalendar,
        duration: `${duration} min`,
        top: `${top}px`,
        height: `${height}px`
      });
    }
    
    return {
      position: 'absolute',
      top: `${top}px`,
      height: `${minHeight}px`,
      minHeight: `${minHeight}px`,
      left: '2px',
      right: '2px',
      backgroundColor: '#4CAF50',
      color: 'white',
      padding: '2px 4px',
      borderRadius: '3px',
      fontSize: '10px',
      cursor: 'pointer',
      textAlign: 'center',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      zIndex: 1,
      pointerEvents: 'auto',
      border: '1px solid #388E3C'
    };
  };

  const getTotalCredits = () => {
    return plannedClasses.reduce((total, cls) => total + (cls.hours || 0), 0);
  };

  const handleSubmitPlan = async () => {
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    try {
      // Determine current semester (you can make this dynamic based on date)
      const currentSemester = 'Fall 2025';
      
      // Use new semester planner endpoint with FULL details
      await saveSemesterPlanner(currentSemester, plannedClasses);
      
      console.log('✅ Semester planner saved to database');
      setSubmitStatus('success');
      setTimeout(() => setSubmitStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save plan:', error);
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Optional: Auto-save when classes change (debounced)
  useEffect(() => {
    if (plannedClasses.length === 0) return;
    
    const autoSave = async () => {
      try {
        await saveSemesterPlanner('Fall 2025', plannedClasses);
        console.log('🔄 Auto-saved planner');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };
    
    // Debounce by 2 seconds to avoid excessive saves
    const timer = setTimeout(autoSave, 2000);
    return () => clearTimeout(timer);
  }, [plannedClasses]);

  return (
    <div className="planner-calendar">
      <div className="calendar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Next Semester Plan - {getTotalCredits()} Credit Hours</h2>
          {plannedClasses.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {submitStatus === 'success' && (
                <span style={{ color: 'green', fontSize: '14px' }}>✅ Plan saved successfully!</span>
              )}
              {submitStatus === 'error' && (
                <span style={{ color: 'red', fontSize: '14px' }}>❌ Failed to save plan</span>
              )}
              {!readOnly && (
                <button
                  onClick={handleSubmitPlan}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: isSubmitting ? '#ccc' : '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '10px 20px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {isSubmitting ? '💾 Saving...' : '💾 Submit Plan to Database'}
                </button>
              )}
            </div>
          )}
        </div>
        
        {plannedClasses.length === 0 && (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            No classes planned yet. Add some from the search!
          </p>
        )}
      </div>
      
      {plannedClasses.length > 0 && (
        <>
          <div className="planned-classes-list" style={{ marginBottom: '20px' }}>
            <h3>Planned Classes:</h3>
            {plannedClasses.map(cls => (
              <div key={cls.id} className="planned-class-item" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px',
                margin: '4px 0',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px'
              }}>
                <span>
                  <strong>{cls.code}</strong>: {cls.name} ({cls.hours || 0} hrs)
                  {cls.schedule && cls.schedule.days && (
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {Array.isArray(cls.schedule.days) ? cls.schedule.days.join(', ') : cls.schedule.days}{' '}
                      {cls.schedule.startTime} - {cls.schedule.endTime}
                    </div>
                  )}
                </span>
                {!readOnly && (
                  <button 
                    onClick={() => {
                      onRemoveClass(cls.courseId);
                    }}
                    style={{ 
                      backgroundColor: '#ff4444', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ 
            display: 'flex',
            backgroundColor: '#ddd',
            border: '1px solid #ddd',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            {/* Time column */}
            <div style={{ width: '80px', flexShrink: 0 }}>
              <div style={{ 
                backgroundColor: '#f0f0f0', 
                padding: '8px', 
                fontWeight: 'bold',
                textAlign: 'center',
                borderBottom: '1px solid #ddd',
                height: '40px',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                Time
              </div>
              {timeSlots.map((time) => (
                <div key={time} style={{ 
                  backgroundColor: '#f9f9f9', 
                  padding: '2px 8px', 
                  fontSize: '12px',
                  textAlign: 'center',
                  borderBottom: '1px solid #ddd',
                  height: '30px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {time}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, dayIndex) => {
              const classesForDay = getClassesForDay(day);
              const totalHeight = timeSlots.length * 30;
              
              return (
                <div 
                  key={day} 
                  style={{ 
                    flex: 1,
                    borderLeft: '1px solid #ddd',
                    position: 'relative',
                    backgroundColor: 'white'
                  }}
                >
                  {/* Day header */}
                  <div style={{ 
                    backgroundColor: '#f0f0f0', 
                    padding: '8px', 
                    fontWeight: 'bold', 
                    textAlign: 'center',
                    borderBottom: '1px solid #ddd',
                    height: '40px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {day}
                  </div>
                  
                  {/* Time slot cells */}
                  {timeSlots.map((time) => (
                    <div 
                      key={`${day}-${time}`} 
                      style={{ 
                        backgroundColor: 'white', 
                        padding: '2px',
                        height: '30px',
                        borderBottom: '1px solid #ddd',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Empty cell - courses rendered via overlay */}
                    </div>
                  ))}
                  
                  {/* Course overlay for this day */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '40px', // After header (exactly 40px)
                      left: '2px',
                      right: '2px',
                      height: `${timeSlots.length * 30}px`, // Exact height: number of slots * 30px per slot
                      pointerEvents: 'none',
                      padding: '0',
                      boxSizing: 'border-box',
                      backgroundColor: 'transparent'
                    }}
                  >
                    {classesForDay.map(cls => (
                      <div
                        key={cls.id}
                        style={getCourseBlockStyle(cls)}
                        title={`${cls.code}: ${cls.name}\n${cls.schedule?.location || 'TBA'}\nProf: ${cls.professors?.join(', ') || 'TBA'}\n${cls.schedule?.startTime} - ${cls.schedule?.endTime}`}
                      >
                        <div style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                          pointerEvents: 'auto'
                        }}>
                          {cls.code}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default PlannerCalendar;