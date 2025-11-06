import React, { useState, useEffect } from 'react';
import { getUserProfile, updateUserProfile } from './api';
import './LoginPage.css';

/**
 * ProfilePage - User profile management page
 * Allows users to edit their major, year, dorm location, and previous courses
 * Mirrors the design and functionality of the onboarding steps
 */
const ProfilePage = ({ user, onProfileUpdate }) => {
  const [formData, setFormData] = useState({
    major: '',
    year: '',
    dorm: '',
    previousCourses: []
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [localErrors, setLocalErrors] = useState({});

  // Available options (same as onboarding)
  const majors = [
    'Computer Science',
    'Computer Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Biomedical Engineering',
    'Chemical Engineering',
    'Civil Engineering',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Psychology',
    'Economics',
    'Business',
    'English',
    'History',
    'Political Science',
    'Other'
  ];

  const academicYears = [
    'Freshman',
    'Sophomore',
    'Junior',
    'Senior',
    'Graduate'
  ];

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await getUserProfile();
        setFormData({
          major: userData.major || '',
          year: userData.year || '',
          dorm: userData.dorm || '',
          previousCourses: userData.previousCourses || []
        });
      } catch (error) {
        console.error('Error loading user profile:', error);
        setErrors({ load: 'Failed to load profile data' });
      }
    };
    loadUserData();
  }, []);

  // Form state for adding new courses
  const [newCourse, setNewCourse] = useState({
    courseCode: '',
    term: ''
  });

  /**
   * Handles form field changes
   */
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors({});
    setSaveMessage('');
  };

  /**
   * Adds a new course to the previous courses list
   */
  const handleAddCourse = () => {
    if (!newCourse.courseCode || !newCourse.term) {
      setLocalErrors({ course: 'Please fill in course code and term' });
      return;
    }

    const course = {
      courseCode: newCourse.courseCode.toUpperCase().trim(),
      term: newCourse.term.trim()
    };

    setFormData(prev => ({
      ...prev,
      previousCourses: [...prev.previousCourses, course]
    }));

    // Reset form
    setNewCourse({ courseCode: '', term: '' });
    setLocalErrors({});
  };

  /**
   * Removes a course from the previous courses list
   */
  const handleRemoveCourse = (index) => {
    setFormData(prev => ({
      ...prev,
      previousCourses: prev.previousCourses.filter((_, i) => i !== index)
    }));
  };

  /**
   * Validates form data
   */
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.major) {
      newErrors.major = 'Please select your major';
    }
    if (!formData.year) {
      newErrors.year = 'Please select your academic year';
    }
    if (!formData.dorm || formData.dorm.trim().length < 2) {
      newErrors.dorm = 'Please enter your dorm location (at least 2 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles form submission
   */
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveMessage('');
    setErrors({});

    try {
      // Filter previousCourses to only include courseCode and term
      const filteredPreviousCourses = formData.previousCourses.map(course => ({
        courseCode: course.courseCode,
        term: course.term
      }));

      const updatedData = {
        major: formData.major,
        year: formData.year,
        dorm: formData.dorm,
        previousCourses: filteredPreviousCourses
      };

      const result = await updateUserProfile(updatedData);
      
      setSaveMessage('Profile updated successfully!');
      if (onProfileUpdate && result.user) {
        onProfileUpdate(result.user);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ save: error.message || 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-page-container" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="step-container">
        {/* Profile Header */}
        <div style={{
          border: 'none',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '40px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}>
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: 'var(--highlight)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--background)',
            fontSize: '36px',
            fontWeight: '600',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flex: 1
          }}>
            {user?.name && (
              <h2 style={{ 
                margin: 0, 
                color: 'white',
                fontSize: '28px',
                fontWeight: '700',
                letterSpacing: '-0.5px'
              }}>
                {user.name}
              </h2>
            )}
            {user?.email && (
              <p style={{ 
                margin: 0, 
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '15px',
                fontWeight: '400'
              }}>
                {user.email}
              </p>
            )}
          </div>
        </div>

        {/* Success Message */}
        {saveMessage && (
          <div style={{
            background: '#d4edda',
            color: '#155724',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #c3e6cb'
          }}>
            {saveMessage}
          </div>
        )}

        {/* Error Message */}
        {(errors.save || errors.load) && (
          <div className="error-message">
            {errors.save || errors.load}
          </div>
        )}

        {/* Major Section */}
        <div className="profile-section" style={{ 
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--background)',
          borderRadius: '10px',
          border: '1px solid #e9ecef',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="major" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px' }}>
              Major <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <select
              id="major"
              value={formData.major}
              onChange={(e) => handleFieldChange('major', e.target.value)}
              className={errors.major ? 'error' : ''}
              style={{ fontSize: '15px' }}
            >
              <option value="">Select your major</option>
              {majors.map(major => (
                <option key={major} value={major}>
                  {major}
                </option>
              ))}
            </select>
            {errors.major && (
              <span className="field-error">{errors.major}</span>
            )}
          </div>
        </div>

        {/* Academic Year Section */}
        <div className="profile-section" style={{ 
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--background)',
          borderRadius: '10px',
          border: '1px solid #e9ecef',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="year" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px' }}>
              Academic Year <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <select
              id="year"
              value={formData.year}
              onChange={(e) => handleFieldChange('year', e.target.value)}
              className={errors.year ? 'error' : ''}
              style={{ fontSize: '15px' }}
            >
              <option value="">Select your year</option>
              {academicYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {errors.year && (
              <span className="field-error">{errors.year}</span>
            )}
          </div>
        </div>

        {/* Dorm Location Section */}
        <div className="profile-section" style={{ 
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--background)',
          borderRadius: '10px',
          border: '1px solid #e9ecef',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="dorm" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px' }}>
              Dorm Location <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="text"
              id="dorm"
              value={formData.dorm}
              onChange={(e) => handleFieldChange('dorm', e.target.value)}
              placeholder="e.g., McTyeire Hall, Commons Center, etc."
              className={errors.dorm ? 'error' : ''}
              style={{ fontSize: '15px' }}
            />
            {errors.dorm && (
              <span className="field-error">{errors.dorm}</span>
            )}
          </div>
        </div>

        {/* Previous Courses Section */}
        <div className="profile-section" style={{ 
          marginBottom: '32px',
          padding: '24px',
          background: 'var(--background)',
          borderRadius: '10px',
          border: '1px solid #e9ecef',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <label style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', display: 'block' }}>
            Previous Courses
          </label>
          <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px', marginTop: '4px' }}>
            Add courses you've already taken to help with degree planning
          </p>

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
                <label htmlFor="term">Course Name *</label>
                <input
                  type="text"
                  id="term"
                  value={newCourse.term}
                  onChange={(e) => setNewCourse(prev => ({ ...prev, term: e.target.value }))}
                  placeholder="e.g., Programming and Problem Solving"
                  className={localErrors.course ? 'error' : ''}
                />
              </div>
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
            </div>

            {localErrors.course && (
              <span className="field-error">{localErrors.course}</span>
            )}

            <button type="button" onClick={handleAddCourse} className="btn-add-course">
              Add Course
            </button>
          </div>

          {formData.previousCourses && formData.previousCourses.length > 0 && (
            <div className="added-courses" style={{ marginTop: '24px' }}>
              <div style={{ 
                color: 'var(--secondary)', 
                marginBottom: '16px', 
                fontSize: '14px', 
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>📚</span>
                <span>Added Courses ({formData.previousCourses.length})</span>
              </div>
              <div className="course-list">
                {formData.previousCourses.map((course, index) => (
                  <div key={index} className="course-item" style={{
                    background: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    transition: 'all 0.2s ease'
                  }}>
                    <div className="course-info">
                      <span className="course-code" style={{ 
                        fontWeight: '600',
                        color: 'var(--secondary)',
                        fontSize: '15px'
                      }}>
                        {course.courseCode}
                      </span>
                      <span className="course-term" style={{ 
                        color: '#666',
                        fontSize: '14px'
                      }}>
                        {course.term}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCourse(index)}
                      className="btn-remove"
                      style={{
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#c82333'}
                      onMouseLeave={(e) => e.target.style.background = '#dc3545'}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '2px solid #e9ecef' }}>
          <button 
            type="button" 
            onClick={handleSave} 
            className="btn-primary"
            disabled={isSaving}
            style={{ 
              width: '100%',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
            }}
            onMouseEnter={(e) => !isSaving && (e.target.style.backgroundColor = '#1976D2')}
            onMouseLeave={(e) => !isSaving && (e.target.style.backgroundColor = '#2196F3')}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

