import React, { useState } from 'react';

const Step3DormLocation = ({ data, onUpdate, onNext, onBack, errors }) => {
  const [localErrors, setLocalErrors] = useState({});

  const handleDormChange = (e) => {
    onUpdate({ dorm: e.target.value });
    setLocalErrors({});
  };

  const handleNext = () => {
    if (!data.dorm || data.dorm.trim().length < 2) {
      setLocalErrors({ dorm: 'Please enter your dorm location (at least 2 characters)' });
      return;
    }
    onNext();
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h3>Step 3: Dorm Location</h3>
        <p>Where do you live on campus?</p>
      </div>

      <div className="form-group">
        <label htmlFor="dorm">Dorm Location *</label>
        <input
          type="text"
          id="dorm"
          value={data.dorm || ''}
          onChange={handleDormChange}
          placeholder="e.g., McTyeire Hall, Commons Center, etc."
          className={localErrors.dorm || errors.dorm ? 'error' : ''}
        />
        {(localErrors.dorm || errors.dorm) && (
          <span className="field-error">{localErrors.dorm || errors.dorm}</span>
        )}
      </div>

      <div className="step-navigation">
        <button type="button" onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button type="button" onClick={handleNext} className="btn-primary">
          Next
        </button>
      </div>
    </div>
  );
};

export default Step3DormLocation;
