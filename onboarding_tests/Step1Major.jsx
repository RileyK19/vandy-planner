import React, { useState } from 'react';

/**
 * Step1Major - First step of user registration
 * Handles major selection with validation and navigation
 * 
 * @param {Object} data - Current form data from parent
 * @param {Function} onUpdate - Callback to update form data
 * @param {Function} onNext - Callback to proceed to next step
 * @param {Function} onBack - Callback to return to previous step
 * @param {Object} errors - Error state from parent
 */
const Step1Major = ({ data, onUpdate, onNext, onBack, errors }) => {
  const [localErrors, setLocalErrors] = useState({}); // Local validation errors

  // Available major options for selection
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

  /**
   * Handles major selection change
   * Updates parent form data and clears any validation errors
   */
  const handleMajorChange = (major) => {
    onUpdate({ major });
    setLocalErrors({});
  };

  /**
   * Validates major selection before proceeding to next step
   * Shows error if no major is selected
   */
  const handleNext = () => {
    if (!data.major) {
      setLocalErrors({ major: 'Please select your major' });
      return;
    }
    onNext();
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h3>Step 1: Major</h3>
        <p>What is your academic major?</p>
      </div>

      <div className="form-group">
        <label htmlFor="major">Major *</label>
        <select
          id="major"
          value={data.major || ''}
          onChange={(e) => handleMajorChange(e.target.value)}
          className={localErrors.major || errors.major ? 'error' : ''}
        >
          <option value="">Select your major</option>
          {majors.map(major => (
            <option key={major} value={major}>
              {major}
            </option>
          ))}
        </select>
        {(localErrors.major || errors.major) && (
          <span className="field-error">{localErrors.major || errors.major}</span>
        )}
      </div>

      <div className="step-navigation">
        <button type="button" onClick={onBack} className="btn-secondary">
          Back to Login
        </button>
        <button type="button" onClick={handleNext} className="btn-primary">
          Next
        </button>
      </div>
    </div>
  );
};

export default Step1Major;
