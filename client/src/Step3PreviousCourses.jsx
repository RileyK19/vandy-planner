import React, { useState } from 'react';

const Step3PreviousCourses = ({ data, onUpdate, onSubmit, onBack, errors, isSubmitting }) => {
  const [localErrors, setLocalErrors] = useState({});
  const [newCourse, setNewCourse] = useState({
    courseCode: '',
    courseName: '',
    term: '',
    grade: '',
    completedAt: ''
  });

  const handleAddCourse = () => {
    if (!newCourse.courseCode || !newCourse.courseName || !newCourse.term || !newCourse.grade) {
      setLocalErrors({ course: 'Please fill in all course fields' });
      return;
    }

    if (!newCourse.completedAt) {
      setLocalErrors({ course: 'Please select completion date' });
      return;
    }

    const course = {
      ...newCourse,
      completedAt: new Date(newCourse.completedAt)
    };

    onUpdate({
      previousCourses: [...(data.previousCourses || []), course]
    });

    setNewCourse({
      courseCode: '',
      courseName: '',
      term: '',
      grade: '',
      completedAt: ''
    });
    setLocalErrors({});
  };

  const handleRemoveCourse = (index) => {
    const updatedCourses = data.previousCourses.filter((_, i) => i !== index);
    onUpdate({ previousCourses: updatedCourses });
  };

  const handleSkip = () => {
    onSubmit();
  };

  const handleComplete = () => {
    onSubmit();
  };

  const gradeOptions = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'NP', 'W'];

  return (
    <div className="step-container">
      <div className="step-header">
        <h3>Step 3: Previous Courses (Optional)</h3>
        <p>Add courses you've already taken to help with degree planning</p>
      </div>

      <div className="previous-courses-section">
        <h4>Add Previous Course</h4>
        
        <div className="course-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="courseCode">Course Code *</label>
              <input
                type="text"
                id="courseCode"
                value={newCourse.courseCode}
                onChange={(e) => setNewCourse(prev => ({ ...prev, courseCode: e.target.value.toUpperCase() }))}
                placeholder="e.g., CS 1101"
                className={localErrors.course ? 'error' : ''}
              />
            </div>
            <div className="form-group">
              <label htmlFor="courseName">Course Name *</label>
              <input
                type="text"
                id="courseName"
                value={newCourse.courseName}
                onChange={(e) => setNewCourse(prev => ({ ...prev, courseName: e.target.value }))}
                placeholder="e.g., Introduction to Programming"
                className={localErrors.course ? 'error' : ''}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="term">Term *</label>
              <input
                type="text"
                id="term"
                value={newCourse.term}
                onChange={(e) => setNewCourse(prev => ({ ...prev, term: e.target.value }))}
                placeholder="e.g., Fall 2023"
                className={localErrors.course ? 'error' : ''}
              />
            </div>
            <div className="form-group">
              <label htmlFor="grade">Grade *</label>
              <select
                id="grade"
                value={newCourse.grade}
                onChange={(e) => setNewCourse(prev => ({ ...prev, grade: e.target.value }))}
                className={localErrors.course ? 'error' : ''}
              >
                <option value="">Select Grade</option>
                {gradeOptions.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="completedAt">Completion Date *</label>
            <input
              type="date"
              id="completedAt"
              value={newCourse.completedAt}
              onChange={(e) => setNewCourse(prev => ({ ...prev, completedAt: e.target.value }))}
              className={localErrors.course ? 'error' : ''}
            />
          </div>

          {localErrors.course && (
            <span className="field-error">{localErrors.course}</span>
          )}

          <button type="button" onClick={handleAddCourse} className="btn-add-course">
            Add Course
          </button>
        </div>

        {data.previousCourses && data.previousCourses.length > 0 && (
          <div className="added-courses">
            <h4>Added Courses ({data.previousCourses.length})</h4>
            <div className="course-list">
              {data.previousCourses.map((course, index) => (
                <div key={index} className="course-item">
                  <div className="course-info">
                    <span className="course-code">{course.courseCode}</span>
                    <span className="course-name">{course.courseName}</span>
                    <span className="course-term">{course.term}</span>
                    <span className="course-grade">{course.grade}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCourse(index)}
                    className="btn-remove"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="step-navigation">
        <button type="button" onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button type="button" onClick={handleSkip} className="btn-secondary">
          Skip for Now
        </button>
        <button 
          type="button" 
          onClick={handleComplete} 
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating Account...' : 'Complete Registration'}
        </button>
      </div>
    </div>
  );
};

export default Step3PreviousCourses;
