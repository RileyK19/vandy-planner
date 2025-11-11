import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';

/**
 * Step4PreviousCourses - Final step of user registration
 * Handles optional previous course entry with add/remove functionality
 * Allows users to skip this step or complete registration
 * 
 * @param {Object} data - Current form data from parent
 * @param {Function} onUpdate - Callback to update form data
 * @param {Function} onSubmit - Callback to complete registration
 * @param {Function} onBack - Callback to return to previous step
 * @param {Object} errors - Error state from parent
 * @param {Boolean} isSubmitting - Loading state for final submission
 */
const Step4PreviousCourses = ({ data, onUpdate, onSubmit, onBack, errors, isSubmitting }) => {
  const [localErrors, setLocalErrors] = useState({}); // Local validation errors
  const [isProcessingPDF, setIsProcessingPDF] = useState(false); // PDF processing state
  const [pdfError, setPdfError] = useState(''); // PDF processing errors
  
  // Form state for adding new courses
  const [newCourse, setNewCourse] = useState({
    courseCode: '',
    term: ''
  });

  /**
   * Adds a new course to the previous courses list
   * Validates required fields (courseCode and term)
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

    onUpdate({
      previousCourses: [...(data.previousCourses || []), course]
    });

    // Reset form after successful addition
    setNewCourse({
      courseCode: '',
      term: ''
    });
    setLocalErrors({});
  };

  /**
   * Removes a course from the previous courses list by index
   */
  const handleRemoveCourse = (index) => {
    const updatedCourses = data.previousCourses.filter((_, i) => i !== index);
    onUpdate({ previousCourses: updatedCourses });
  };

  /**
   * Skips course entry and proceeds to registration completion
   */
  const handleSkip = () => {
    onSubmit();
  };

  /**
   * Completes registration with current course data
   */
  const handleComplete = () => {
    onSubmit();
  };

  /**
   * Processes uploaded PDF transcript to extract course information
   */
  const processTranscriptPDF = async (file) => {
    setIsProcessingPDF(true);
    setPdfError('');
    
    try {
      const formData = new FormData();
      formData.append('transcript', file);
      
      const response = await fetch('/api/parse-transcript', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process PDF: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Add parsed courses to the form data
      // Only extract courseCode and term from parsed courses
      if (result.courses && result.courses.length > 0) {
        const existingCourses = data.previousCourses || [];
        const parsedCourses = result.courses.map(course => ({
          courseCode: course.courseCode,
          term: course.term
        }));
        const allCourses = [...existingCourses, ...parsedCourses];
        
        onUpdate({ previousCourses: allCourses });
        
        // Show success message
        console.log(`Successfully parsed ${result.courses.length} courses from transcript`);
      } else {
        setPdfError('No courses found in the uploaded transcript. Please check the file format.');
      }
      
    } catch (error) {
      console.error('PDF processing error:', error);
      setPdfError(error.message || 'Failed to process transcript. Please try again.');
    } finally {
      setIsProcessingPDF(false);
    }
  };

  /**
   * Dropzone configuration for PDF uploads
   */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        processTranscriptPDF(acceptedFiles[0]);
      }
    },
    disabled: isProcessingPDF
  });

  return (
    <div className="step-container">
      <div className="step-header">
        <h3>Step 4: Previous Courses (Optional)</h3>
        <p>Add courses you've already taken to help with degree planning</p>
      </div>

      {/* PDF Upload Section */}
      <div className="pdf-upload-section">
        <h4>Upload Transcript PDF</h4>
        <p>Drop your transcript PDF here to automatically extract course information</p>
        
        <div 
          {...getRootProps()} 
          className={`pdf-dropzone ${isDragActive ? 'drag-active' : ''} ${isProcessingPDF ? 'processing' : ''}`}
        >
          <input {...getInputProps()} />
          {isProcessingPDF ? (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <p>Processing transcript...</p>
            </div>
          ) : (
            <div className="dropzone-content">
              <div className="upload-icon">📄</div>
              {isDragActive ? (
                <p>Drop your PDF transcript here...</p>
              ) : (
                <div>
                  <p>Drag & drop your transcript PDF here, or click to select</p>
                  <p className="file-hint">Supported format: PDF files only</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {pdfError && (
          <div className="pdf-error">
            <span className="error-icon">⚠️</span>
            {pdfError}
          </div>
        )}
      </div>

      <div className="divider">
        <span>OR</span>
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
                <label htmlFor="term">Course Name *</label>
                <input
                  type="text"
                  id="name"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Programming and Problem Solving"
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

        {data.previousCourses && data.previousCourses.length > 0 && (
          <div className="added-courses">
            <h4>Added Courses ({data.previousCourses.length})</h4>
            <div className="course-list">
              {data.previousCourses.map((course, index) => (
                <div key={index} className="course-item">
                  <div className="course-info">
                    <span className="course-code">{course.courseCode}</span>
                    <span className="course-term">{course.term}</span>
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

export default Step4PreviousCourses;
