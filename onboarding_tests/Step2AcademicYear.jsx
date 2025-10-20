import React, { useState } from 'react';

/**
 * Step2AcademicYear - Second step of user registration
 * Handles academic year selection with validation and navigation
 * 
 * @param {Object} data - Current form data from parent
 * @param {Function} onUpdate - Callback to update form data
 * @param {Function} onNext - Callback to proceed to next step
 * @param {Function} onBack - Callback to return to previous step
 * @param {Object} errors - Error state from parent
 */
const Step2AcademicYear = ({ data, onUpdate, onNext, onBack, errors }) => {
  const [localErrors, setLocalErrors] = useState({}); // Local validation errors

  // Available academic year options
  const academicYears = [
    'Freshman',
    'Sophomore', 
    'Junior',
    'Senior',
    'Graduate'
  ];

  /**
   * Handles academic year selection change
   * Updates parent form data and clears any validation errors
   */
  const handleYearChange = (year) => {
    onUpdate({ year });
    setLocalErrors({});
  };

  /**
   * Validates academic year selection before proceeding to next step
   * Shows error if no year is selected
   */
  const handleNext = () => {
    if (!data.year) {
      setLocalErrors({ year: 'Please select your academic year' });
      return;
    }
    onNext();
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h3>Step 2: Academic Year</h3>
        <p>What year are you in your academic journey?</p>
      </div>

      <div className="form-group">
        <label htmlFor="year">Academic Year *</label>
        <select
          id="year"
          value={data.year || ''}
          onChange={(e) => handleYearChange(e.target.value)}
          className={localErrors.year || errors.year ? 'error' : ''}
        >
          <option value="">Select your year</option>
          {academicYears.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        {(localErrors.year || errors.year) && (
          <span className="field-error">{localErrors.year || errors.year}</span>
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

export default Step2AcademicYear;
