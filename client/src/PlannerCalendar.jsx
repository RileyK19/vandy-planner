// PlannerCalendar.js - Calendar component for planned classes

import React, { useState } from 'react';

function PlannerCalendar({ plannedClasses, onRemoveClass, onSavePlan }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null

  const timeSlots = [];
  for (let hour = 8; hour <= 18; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const getClassesForTimeSlot = (day, time) => {
    return plannedClasses.filter(cls => {
      if (!cls.schedule || !cls.schedule.days || !cls.schedule.startTime || !cls.schedule.endTime) {
        return false;
      }
      
      const classDays = Array.isArray(cls.schedule.days) ? cls.schedule.days : [cls.schedule.days];
      const startTime = cls.schedule.startTime;
      const endTime = cls.schedule.endTime;
      
      // Check if class is on this day and overlaps with this time slot
      if (classDays.includes(day)) {
        const [currentHour, currentMin] = time.split(':').map(Number);
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        
        const currentMinutes = currentHour * 60 + currentMin;
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }
      return false;
    });
  };

  const getTotalCredits = () => {
    return plannedClasses.reduce((total, cls) => total + (cls.hours || 0), 0);
  };

  const handleSubmitPlan = async () => {
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    try {
      await onSavePlan();
      setSubmitStatus('success');
      setTimeout(() => setSubmitStatus(null), 3000); // Clear after 3 seconds
    } catch (error) {
      console.error('Failed to save plan:', error);
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus(null), 5000); // Clear after 5 seconds
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="planner-calendar">
      <div className="calendar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>My Planner - {getTotalCredits()} Credit Hours</h2>
          {plannedClasses.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {submitStatus === 'success' && (
                <span style={{ color: 'green', fontSize: '14px' }}>✅ Plan saved successfully!</span>
              )}
              {submitStatus === 'error' && (
                <span style={{ color: 'red', fontSize: '14px' }}>❌ Failed to save plan</span>
              )}
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
                <button 
                  onClick={() => onRemoveClass(cls.id)}
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
              </div>
            ))}
          </div>

          <div className="calendar-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: '80px repeat(5, 1fr)',
            gap: '1px',
            backgroundColor: '#ddd',
            border: '1px solid #ddd',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            {/* Header row */}
            <div style={{ 
              backgroundColor: '#f0f0f0', 
              padding: '8px', 
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              Time
            </div>
            {days.map(day => (
              <div key={day} style={{ 
                backgroundColor: '#f0f0f0', 
                padding: '8px', 
                fontWeight: 'bold', 
                textAlign: 'center' 
              }}>
                {day}
              </div>
            ))}

            {/* Time slots */}
            {timeSlots.map(time => (
              <React.Fragment key={time}>
                <div style={{ 
                  backgroundColor: '#f9f9f9', 
                  padding: '8px', 
                  fontSize: '12px',
                  textAlign: 'center',
                  borderRight: '1px solid #ddd'
                }}>
                  {time}
                </div>
                {days.map(day => {
                  const classesInSlot = getClassesForTimeSlot(day, time);
                  return (
                    <div key={`${day}-${time}`} style={{ 
                      backgroundColor: 'white', 
                      padding: '2px',
                      minHeight: '30px',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      {classesInSlot.map(cls => (
                        <div 
                          key={cls.id} 
                          style={{
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            margin: '1px 0',
                            cursor: 'pointer',
                            textAlign: 'center',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}
                          title={`${cls.code}: ${cls.name}\n${cls.schedule?.location || 'TBA'}\nProf: ${cls.professors?.join(', ') || 'TBA'}`}
                        >
                          {cls.code}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PlannerCalendar;