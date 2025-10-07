import React, { useState, useEffect } from 'react';
import Step1AcademicYear from './Step1AcademicYear';
import Step2DormLocation from './Step2DormLocation';
import Step3PreviousCourses from './Step3PreviousCourses';
import { registerUser } from './api';
import './LoginPage.css';

const MultiStepRegistration = ({ onRegistrationComplete, onBackToLogin, initialData = {} }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: initialData.email || '',
    password: initialData.password || '',
    name: initialData.name || '',
    year: '',
    dorm: '',
    previousCourses: []
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 3;

  // Update form data
  const updateFormData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
    // Clear errors when data is updated
    setErrors({});
  };

  // Navigate to next step
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Handle final submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await registerUser(formData);
      console.log('Registration successful:', result);
      onRegistrationComplete(result.user);
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }, (_, index) => (
        <div
          key={index + 1}
          className={`step ${currentStep > index + 1 ? 'completed' : currentStep === index + 1 ? 'active' : ''}`}
        >
          <div className="step-number">{index + 1}</div>
          <div className="step-label">
            {index === 0 && 'Academic Year'}
            {index === 1 && 'Dorm Location'}
            {index === 2 && 'Previous Courses'}
          </div>
        </div>
      ))}
    </div>
  );

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1AcademicYear
            data={formData}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={onBackToLogin}
            errors={errors}
          />
        );
      case 2:
        return (
          <Step2DormLocation
            data={formData}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
            errors={errors}
          />
        );
      case 3:
        return (
          <Step3PreviousCourses
            data={formData}
            onUpdate={updateFormData}
            onSubmit={handleSubmit}
            onBack={prevStep}
            errors={errors}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="multi-step-registration">
      <div className="registration-container">
        <div className="registration-header">
          <h2>Create Your Account</h2>
          <p>Complete your profile to get started with Vandy Planner</p>
        </div>

        {renderStepIndicator()}

        <div className="step-content">
          {renderCurrentStep()}
        </div>

        {errors.submit && (
          <div className="error-message">
            {errors.submit}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiStepRegistration;
