import React, { useState } from 'react';

const Step1Major = ({ data, onUpdate, onNext, onBack, errors }) => {
  const [localErrors, setLocalErrors] = useState({});

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

  const handleMajorChange = (major) => {
    onUpdate({ major });
    setLocalErrors({});
  };

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
