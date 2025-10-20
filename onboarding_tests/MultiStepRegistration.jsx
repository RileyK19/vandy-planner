import React, { useState, useEffect } from 'react';
import Step1Major from './Step1Major';
import Step2AcademicYear from './Step2AcademicYear';
import Step3DormLocation from './Step3DormLocation';
import Step4PreviousCourses from './Step4PreviousCourses';
import { registerUser } from './api';
import './LoginPage.css';

/**
 * MultiStepRegistration - Orchestrates the 4-step user registration process
 * Manages step navigation, form data aggregation, and final user registration
 * 
 * @param {Function} onRegistrationComplete - Callback when registration succeeds
 * @param {Function} onBackToLogin - Callback to return to login page
 * @param {Object} initialData - Pre-filled data from login form (email, password, name)
 */
const MultiStepRegistration = ({ onRegistrationComplete, onBackToLogin, initialData = {} }) => {
  // Step management
  const [currentStep, setCurrentStep] = useState(1); // Current step (1-4)
  
  // Aggregated form data from all steps
  const [formData, setFormData] = useState({
    email: initialData.email || '',
    password: initialData.password || '',
    name: initialData.name || '',
    major: '', // Step 1
    year: '', // Step 2
    dorm: '', // Step 3
    previousCourses: [] // Step 4
  });
  
  // Error handling
  const [errors, setErrors] = useState({}); // Step-specific and submission errors
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for final submission
  
  const totalSteps = 4;

  /**
   * Updates aggregated form data from individual steps
   * Clears errors when data is updated to provide immediate feedback
   */
  const updateFormData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
    // Clear errors when data is updated
    setErrors({});
  };

  /**
   * Advances to the next step in the registration process
   * Individual steps handle their own validation before calling this
   */
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  /**
   * Returns to the previous step
   * Allows users to go back and modify their selections
   */
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  /**
   * Handles final registration submission
   * Sends all collected form data to the API and handles success/error states
   */
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

  /**
   * Renders the step progress indicator
   * Shows current step, completed steps, and step labels
   */
  const renderStepIndicator = () => (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }, (_, index) => (
        <div
          key={index + 1}
          className={`step ${currentStep > index + 1 ? 'completed' : currentStep === index + 1 ? 'active' : ''}`}
        >
          <div className="step-number">{index + 1}</div>
          <div className="step-label">
            {index === 0 && 'Major'}
            {index === 1 && 'Academic Year'}
            {index === 2 && 'Dorm Location'}
            {index === 3 && 'Previous Courses'}
          </div>
        </div>
      ))}
    </div>
  );

  /**
   * Renders the current step component based on currentStep state
   * Each step receives form data, update function, navigation callbacks, and error state
   */
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Major
            data={formData}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={onBackToLogin}
            errors={errors}
          />
        );
      case 2:
        return (
          <Step2AcademicYear
            data={formData}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
            errors={errors}
          />
        );
      case 3:
        return (
          <Step3DormLocation
            data={formData}
            onUpdate={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
            errors={errors}
          />
        );
      case 4:
        return (
          <Step4PreviousCourses
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
