import React, { useState } from 'react';

const Step1AcademicYear = ({ data, onUpdate, onNext, onBack, errors }) => {
  const [localErrors, setLocalErrors] = useState({});

  const academicYears = [
    'Freshman',
    'Sophomore', 
    'Junior',
    'Senior',
    'Graduate'
  ];

  const handleYearChange = (year) => {
    onUpdate({ year });
    setLocalErrors({});
  };

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
        <h3>Step 1: Academic Year</h3>
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

export default Step1AcademicYear;
