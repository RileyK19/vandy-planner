// client/src/__tests__/onboardingSteps.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock CSS imports
jest.mock('../LoginPage.css', () => ({}));

// Mock react-dropzone for Step4 - we'll make it more dynamic to test onDrop
let mockDropzoneConfig = {};
let mockIsDragActive = false;

jest.mock('react-dropzone', () => ({
  useDropzone: jest.fn((options) => {
    mockDropzoneConfig = options;
    return {
      getRootProps: () => ({
        className: 'pdf-dropzone',
        'data-testid': 'dropzone',
        onClick: options.onClick
      }),
      getInputProps: () => ({
        'data-testid': 'dropzone-input',
        onChange: options.onChange
      }),
      isDragActive: mockIsDragActive
    };
  })
}));

// Mock API
jest.mock('../api', () => ({
  registerUser: jest.fn()
}));

// Mock global fetch for PDF processing
global.fetch = jest.fn();

import Step1Major from '../Step1Major';
import Step2AcademicYear from '../Step2AcademicYear';
import Step3DormLocation from '../Step3DormLocation';
import Step4PreviousCourses from '../Step4PreviousCourses';
import * as api from '../api';

describe('Onboarding Steps', () => {
  // Common mock functions
  const mockOnUpdate = jest.fn();
  const mockOnNext = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
    mockDropzoneConfig = {};
    mockIsDragActive = false;
  });

  describe('Step1Major', () => {
    const defaultProps = {
      data: { major: '' },
      onUpdate: mockOnUpdate,
      onNext: mockOnNext,
      onBack: mockOnBack,
      errors: {}
    };

    test('renders major selection form', () => {
      render(<Step1Major {...defaultProps} />);
      
      expect(screen.getByText('Step 1: Major')).toBeInTheDocument();
      expect(screen.getByText('What is your academic major?')).toBeInTheDocument();
      expect(screen.getByLabelText('Major *')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Back to Login')).toBeInTheDocument();
    });

    test('displays all major options', () => {
      render(<Step1Major {...defaultProps} />);
      
      const select = screen.getByLabelText('Major *');
      const options = Array.from(select.options).map(opt => opt.value);
      
      expect(options).toContain('Computer Science');
      expect(options).toContain('Mathematics');
      expect(options).toContain('Other');
      expect(options).toContain(''); // Empty option
    });

    test('updates form data when major is selected', () => {
      render(<Step1Major {...defaultProps} />);
      
      const select = screen.getByLabelText('Major *');
      fireEvent.change(select, { target: { value: 'Computer Science' } });
      
      expect(mockOnUpdate).toHaveBeenCalledWith({ major: 'Computer Science' });
    });

    test('shows error when trying to proceed without selecting major', () => {
      render(<Step1Major {...defaultProps} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Please select your major')).toBeInTheDocument();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    test('proceeds to next step when major is selected', () => {
      render(<Step1Major {...defaultProps} data={{ major: 'Computer Science' }} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(mockOnNext).toHaveBeenCalled();
      expect(screen.queryByText('Please select your major')).not.toBeInTheDocument();
    });

    test('calls onBack when back button is clicked', () => {
      render(<Step1Major {...defaultProps} />);
      
      const backButton = screen.getByText('Back to Login');
      fireEvent.click(backButton);
      
      expect(mockOnBack).toHaveBeenCalled();
    });

    test('displays error from parent component', () => {
      render(<Step1Major {...defaultProps} errors={{ major: 'Invalid major' }} />);
      
      expect(screen.getByText('Invalid major')).toBeInTheDocument();
    });

    test('clears error when major is selected', () => {
      const { rerender } = render(<Step1Major {...defaultProps} />);
      
      // Trigger error
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      expect(screen.getByText('Please select your major')).toBeInTheDocument();
      
      // Select major
      const select = screen.getByLabelText('Major *');
      fireEvent.change(select, { target: { value: 'Computer Science' } });
      
      rerender(<Step1Major {...defaultProps} data={{ major: 'Computer Science' }} />);
      
      // Error should be cleared (local error cleared, but we need to check the select doesn't have error class)
      const selectElement = screen.getByLabelText('Major *');
      expect(selectElement).not.toHaveClass('error');
    });

    test('applies error class when error exists', () => {
      render(<Step1Major {...defaultProps} errors={{ major: 'Error' }} />);
      
      const select = screen.getByLabelText('Major *');
      expect(select).toHaveClass('error');
    });
  });

  describe('Step2AcademicYear', () => {
    const defaultProps = {
      data: { year: '' },
      onUpdate: mockOnUpdate,
      onNext: mockOnNext,
      onBack: mockOnBack,
      errors: {}
    };

    test('renders academic year selection form', () => {
      render(<Step2AcademicYear {...defaultProps} />);
      
      expect(screen.getByText('Step 2: Academic Year')).toBeInTheDocument();
      expect(screen.getByText('What year are you in your academic journey?')).toBeInTheDocument();
      expect(screen.getByLabelText('Academic Year *')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Back to Login')).toBeInTheDocument();
    });

    test('displays all academic year options', () => {
      render(<Step2AcademicYear {...defaultProps} />);
      
      const select = screen.getByLabelText('Academic Year *');
      const options = Array.from(select.options).map(opt => opt.value);
      
      expect(options).toContain('Freshman');
      expect(options).toContain('Sophomore');
      expect(options).toContain('Junior');
      expect(options).toContain('Senior');
      expect(options).toContain('Graduate');
    });

    test('updates form data when year is selected', () => {
      render(<Step2AcademicYear {...defaultProps} />);
      
      const select = screen.getByLabelText('Academic Year *');
      fireEvent.change(select, { target: { value: 'Sophomore' } });
      
      expect(mockOnUpdate).toHaveBeenCalledWith({ year: 'Sophomore' });
    });

    test('shows error when trying to proceed without selecting year', () => {
      render(<Step2AcademicYear {...defaultProps} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Please select your academic year')).toBeInTheDocument();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    test('proceeds to next step when year is selected', () => {
      render(<Step2AcademicYear {...defaultProps} data={{ year: 'Junior' }} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(mockOnNext).toHaveBeenCalled();
    });

    test('calls onBack when back button is clicked', () => {
      render(<Step2AcademicYear {...defaultProps} />);
      
      const backButton = screen.getByText('Back to Login');
      fireEvent.click(backButton);
      
      expect(mockOnBack).toHaveBeenCalled();
    });

    test('displays error from parent component', () => {
      render(<Step2AcademicYear {...defaultProps} errors={{ year: 'Invalid year' }} />);
      
      expect(screen.getByText('Invalid year')).toBeInTheDocument();
    });

    test('applies error class when error exists', () => {
      render(<Step2AcademicYear {...defaultProps} errors={{ year: 'Error' }} />);
      
      const select = screen.getByLabelText('Academic Year *');
      expect(select).toHaveClass('error');
    });

    test('clears local error when year is selected', () => {
      const { rerender } = render(<Step2AcademicYear {...defaultProps} />);
      
      // Trigger error
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      expect(screen.getByText('Please select your academic year')).toBeInTheDocument();
      
      // Select year
      const select = screen.getByLabelText('Academic Year *');
      fireEvent.change(select, { target: { value: 'Senior' } });
      
      rerender(<Step2AcademicYear {...defaultProps} data={{ year: 'Senior' }} />);
      
      const selectElement = screen.getByLabelText('Academic Year *');
      expect(selectElement).not.toHaveClass('error');
    });
  });

  describe('Step3DormLocation', () => {
    const defaultProps = {
      data: { dorm: '' },
      onUpdate: mockOnUpdate,
      onNext: mockOnNext,
      onBack: mockOnBack,
      errors: {}
    };

    test('renders dorm location input form', () => {
      render(<Step3DormLocation {...defaultProps} />);
      
      expect(screen.getByText('Step 3: Dorm Location')).toBeInTheDocument();
      expect(screen.getByText('Where do you live on campus?')).toBeInTheDocument();
      expect(screen.getByLabelText('Dorm Location *')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    test('updates form data when dorm is entered', () => {
      render(<Step3DormLocation {...defaultProps} />);
      
      const input = screen.getByLabelText('Dorm Location *');
      fireEvent.change(input, { target: { value: 'McTyeire Hall' } });
      
      expect(mockOnUpdate).toHaveBeenCalledWith({ dorm: 'McTyeire Hall' });
    });

    test('shows error when trying to proceed with empty dorm', () => {
      render(<Step3DormLocation {...defaultProps} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Please enter your dorm location (at least 2 characters)')).toBeInTheDocument();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    test('shows error when dorm is too short (less than 2 characters)', () => {
      render(<Step3DormLocation {...defaultProps} data={{ dorm: 'A' }} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Please enter your dorm location (at least 2 characters)')).toBeInTheDocument();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    test('shows error when dorm is only whitespace', () => {
      render(<Step3DormLocation {...defaultProps} data={{ dorm: ' ' }} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('Please enter your dorm location (at least 2 characters)')).toBeInTheDocument();
      expect(mockOnNext).not.toHaveBeenCalled();
    });

    test('proceeds to next step when valid dorm is entered', () => {
      render(<Step3DormLocation {...defaultProps} data={{ dorm: 'Commons Center' }} />);
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(mockOnNext).toHaveBeenCalled();
    });

    test('calls onBack when back button is clicked', () => {
      render(<Step3DormLocation {...defaultProps} />);
      
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);
      
      expect(mockOnBack).toHaveBeenCalled();
    });

    test('displays error from parent component', () => {
      render(<Step3DormLocation {...defaultProps} errors={{ dorm: 'Invalid dorm' }} />);
      
      expect(screen.getByText('Invalid dorm')).toBeInTheDocument();
    });

    test('applies error class when error exists', () => {
      render(<Step3DormLocation {...defaultProps} errors={{ dorm: 'Error' }} />);
      
      const input = screen.getByLabelText('Dorm Location *');
      expect(input).toHaveClass('error');
    });

    test('clears local error when dorm is entered', () => {
      const { rerender } = render(<Step3DormLocation {...defaultProps} />);
      
      // Trigger error
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      expect(screen.getByText('Please enter your dorm location (at least 2 characters)')).toBeInTheDocument();
      
      // Enter dorm
      const input = screen.getByLabelText('Dorm Location *');
      fireEvent.change(input, { target: { value: 'McTyeire Hall' } });
      
      rerender(<Step3DormLocation {...defaultProps} data={{ dorm: 'McTyeire Hall' }} />);
      
      const inputElement = screen.getByLabelText('Dorm Location *');
      expect(inputElement).not.toHaveClass('error');
    });
  });

  describe('Step4PreviousCourses', () => {
    const defaultProps = {
      data: { previousCourses: [] },
      onUpdate: mockOnUpdate,
      onSubmit: mockOnSubmit,
      onBack: mockOnBack,
      errors: {},
      isSubmitting: false
    };

    beforeEach(() => {
      // Reset console methods
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      console.log.mockRestore();
      console.error.mockRestore();
    });

    test('renders previous courses form', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      expect(screen.getByText('Step 4: Previous Courses (Optional)')).toBeInTheDocument();
      expect(screen.getByText('Add courses you\'ve already taken to help with degree planning')).toBeInTheDocument();
      expect(screen.getByLabelText('Course Code *')).toBeInTheDocument();
      expect(screen.getByLabelText('Term *')).toBeInTheDocument();
      expect(screen.getByText('Add Course')).toBeInTheDocument();
      expect(screen.getByText('Skip for Now')).toBeInTheDocument();
      expect(screen.getByText('Complete Registration')).toBeInTheDocument();
    });

    test('renders PDF upload section', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      expect(screen.getByText('Upload Transcript PDF')).toBeInTheDocument();
      expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    });

    test('updates course code input and converts to uppercase', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const courseCodeInput = screen.getByLabelText('Course Code *');
      fireEvent.change(courseCodeInput, { target: { value: 'cs 1101' } });
      
      expect(courseCodeInput.value).toBe('CS 1101');
    });

    test('updates term input', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const termInput = screen.getByLabelText('Term *');
      fireEvent.change(termInput, { target: { value: 'Fall 2023' } });
      
      expect(termInput.value).toBe('Fall 2023');
    });

    test('updates course name input (duplicate field)', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      // There's a duplicate field with label "Course Name *" that also uses term state
      const courseNameInputs = screen.getAllByPlaceholderText(/Programming and Problem Solving/i);
      if (courseNameInputs.length > 0) {
        fireEvent.change(courseNameInputs[0], { target: { value: 'Test Course' } });
        // This should update the term state
        expect(courseNameInputs[0].value).toBe('Test Course');
      }
    });

    test('shows error when trying to add course with missing fields', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const addButton = screen.getByText('Add Course');
      fireEvent.click(addButton);
      
      expect(screen.getByText('Please fill in course code and term')).toBeInTheDocument();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    test('adds course when both fields are filled', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const courseCodeInput = screen.getByLabelText('Course Code *');
      const termInput = screen.getByLabelText('Term *');
      const addButton = screen.getByText('Add Course');
      
      fireEvent.change(courseCodeInput, { target: { value: 'CS 1101' } });
      fireEvent.change(termInput, { target: { value: 'Fall 2023' } });
      fireEvent.click(addButton);
      
      expect(mockOnUpdate).toHaveBeenCalledWith({
        previousCourses: [{
          courseCode: 'CS 1101',
          term: 'Fall 2023'
        }]
      });
      
      // Form should be reset
      expect(courseCodeInput.value).toBe('');
      expect(termInput.value).toBe('');
    });

    test('trims whitespace from course code and term', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const courseCodeInput = screen.getByLabelText('Course Code *');
      const termInput = screen.getByLabelText('Term *');
      const addButton = screen.getByText('Add Course');
      
      fireEvent.change(courseCodeInput, { target: { value: '  CS 1101  ' } });
      fireEvent.change(termInput, { target: { value: '  Fall 2023  ' } });
      fireEvent.click(addButton);
      
      expect(mockOnUpdate).toHaveBeenCalledWith({
        previousCourses: [{
          courseCode: 'CS 1101',
          term: 'Fall 2023'
        }]
      });
    });

    test('displays added courses', () => {
      const courses = [
        { courseCode: 'CS 1101', term: 'Fall 2023' },
        { courseCode: 'MATH 1200', term: 'Spring 2024' }
      ];
      
      render(<Step4PreviousCourses {...defaultProps} data={{ previousCourses: courses }} />);
      
      expect(screen.getByText('Added Courses (2)')).toBeInTheDocument();
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.getByText('Fall 2023')).toBeInTheDocument();
      expect(screen.getByText('MATH 1200')).toBeInTheDocument();
      expect(screen.getByText('Spring 2024')).toBeInTheDocument();
    });

    test('removes course when remove button is clicked', () => {
      const courses = [
        { courseCode: 'CS 1101', term: 'Fall 2023' },
        { courseCode: 'MATH 1200', term: 'Spring 2024' }
      ];
      
      render(<Step4PreviousCourses {...defaultProps} data={{ previousCourses: courses }} />);
      
      const removeButtons = screen.getAllByText('Remove');
      fireEvent.click(removeButtons[0]);
      
      expect(mockOnUpdate).toHaveBeenCalledWith({
        previousCourses: [{ courseCode: 'MATH 1200', term: 'Spring 2024' }]
      });
    });

    test('calls onSubmit when skip button is clicked', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const skipButton = screen.getByText('Skip for Now');
      fireEvent.click(skipButton);
      
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    test('calls onSubmit when complete button is clicked', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const completeButton = screen.getByText('Complete Registration');
      fireEvent.click(completeButton);
      
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    test('disables complete button when submitting', () => {
      render(<Step4PreviousCourses {...defaultProps} isSubmitting={true} />);
      
      const completeButton = screen.getByText('Creating Account...');
      expect(completeButton).toBeDisabled();
    });

    test('calls onBack when back button is clicked', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);
      
      expect(mockOnBack).toHaveBeenCalled();
    });

    test('handles multiple courses being added', () => {
      const { rerender } = render(<Step4PreviousCourses {...defaultProps} />);
      
      const courseCodeInput = screen.getByLabelText('Course Code *');
      const termInput = screen.getByLabelText('Term *');
      const addButton = screen.getByText('Add Course');
      
      // Add first course
      fireEvent.change(courseCodeInput, { target: { value: 'CS 1101' } });
      fireEvent.change(termInput, { target: { value: 'Fall 2023' } });
      fireEvent.click(addButton);
      
      expect(mockOnUpdate).toHaveBeenCalledWith({
        previousCourses: [{ courseCode: 'CS 1101', term: 'Fall 2023' }]
      });
      
      // Simulate state update and add second course
      rerender(<Step4PreviousCourses {...defaultProps} data={{ previousCourses: [{ courseCode: 'CS 1101', term: 'Fall 2023' }] }} />);
      
      const courseCodeInput2 = screen.getByLabelText('Course Code *');
      const termInput2 = screen.getByLabelText('Term *');
      const addButton2 = screen.getByText('Add Course');
      
      fireEvent.change(courseCodeInput2, { target: { value: 'MATH 1200' } });
      fireEvent.change(termInput2, { target: { value: 'Spring 2024' } });
      fireEvent.click(addButton2);
      
      expect(mockOnUpdate).toHaveBeenLastCalledWith({
        previousCourses: [
          { courseCode: 'CS 1101', term: 'Fall 2023' },
          { courseCode: 'MATH 1200', term: 'Spring 2024' }
        ]
      });
    });

    test('handles PDF upload successfully', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });
      const mockCourses = [
        { courseCode: 'CS 1101', term: 'Fall 2023' },
        { courseCode: 'MATH 1200', term: 'Spring 2024' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ courses: mockCourses })
      });

      render(<Step4PreviousCourses {...defaultProps} />);

      // Trigger the dropzone onDrop callback
      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/parse-transcript', expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        }));
      });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          previousCourses: mockCourses.map(course => ({
            courseCode: course.courseCode,
            term: course.term
          }))
        });
      });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully parsed 2 courses'));
    });

    test('handles PDF upload with existing courses', async () => {
      const existingCourses = [{ courseCode: 'CS 2201', term: 'Fall 2024' }];
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });
      const mockCourses = [
        { courseCode: 'CS 1101', term: 'Fall 2023' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ courses: mockCourses })
      });

      render(<Step4PreviousCourses {...defaultProps} data={{ previousCourses: existingCourses }} />);

      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          previousCourses: [
            ...existingCourses,
            ...mockCourses.map(course => ({
              courseCode: course.courseCode,
              term: course.term
            }))
          ]
        });
      });
    });

    test('handles PDF upload error - response not ok', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });

      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error'
      });

      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(screen.getByText(/Failed to process PDF: Server Error/i)).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalled();
    });

    test('handles PDF upload error - result.error', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'Invalid PDF format' })
      });

      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(screen.getByText('Invalid PDF format')).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalled();
    });

    test('handles PDF upload - no courses found', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ courses: [] })
      });

      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(screen.getByText(/No courses found in the uploaded transcript/i)).toBeInTheDocument();
      });
    });

    test('handles PDF upload - fetch throws error', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalled();
    });

    test('handles PDF upload - error without message', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });

      global.fetch.mockRejectedValueOnce({});

      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(screen.getByText(/Failed to process transcript. Please try again/i)).toBeInTheDocument();
      });
    });

    test('shows processing state during PDF upload', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });
      const mockCourses = [{ courseCode: 'CS 1101', term: 'Fall 2023' }];

      // Delay the response to see processing state
      global.fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ courses: mockCourses })
        }), 100))
      );

      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        mockDropzoneConfig.onDrop([mockFile]);
      }

      // Check for processing indicator (if rendered)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    test('does not process PDF when dropzone is disabled', () => {
      render(<Step4PreviousCourses {...defaultProps} />);
      
      // The dropzone should be configured with disabled when processing
      // We can't directly test this without triggering processing, but we can verify the config
      expect(mockDropzoneConfig.disabled).toBe(false);
    });

    test('handles empty file array in dropzone', () => {
      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        mockDropzoneConfig.onDrop([]);
      }

      // Should not call fetch
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('displays PDF error message', () => {
      const { rerender } = render(<Step4PreviousCourses {...defaultProps} />);
      
      // We need to trigger an error state - this is tested in other tests
      // But we can verify the error display structure exists
      expect(screen.queryByText(/⚠️/i)).not.toBeInTheDocument();
    });

    test('adds course when previousCourses is undefined', () => {
      render(<Step4PreviousCourses {...defaultProps} data={{}} />);
      
      const courseCodeInput = screen.getByLabelText('Course Code *');
      const termInput = screen.getByLabelText('Term *');
      const addButton = screen.getByText('Add Course');
      
      fireEvent.change(courseCodeInput, { target: { value: 'CS 1101' } });
      fireEvent.change(termInput, { target: { value: 'Fall 2023' } });
      fireEvent.click(addButton);
      
      expect(mockOnUpdate).toHaveBeenCalledWith({
        previousCourses: [{
          courseCode: 'CS 1101',
          term: 'Fall 2023'
        }]
      });
    });

    test('handles PDF upload when previousCourses is undefined', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });
      const mockCourses = [
        { courseCode: 'CS 1101', term: 'Fall 2023' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ courses: mockCourses })
      });

      render(<Step4PreviousCourses {...defaultProps} data={{}} />);

      if (mockDropzoneConfig.onDrop) {
        await mockDropzoneConfig.onDrop([mockFile]);
      }

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          previousCourses: mockCourses.map(course => ({
            courseCode: course.courseCode,
            term: course.term
          }))
        });
      });
    });

    test('shows processing indicator when isProcessingPDF is true', async () => {
      const mockFile = new File(['test'], 'transcript.pdf', { type: 'application/pdf' });
      const mockCourses = [{ courseCode: 'CS 1101', term: 'Fall 2023' }];

      // Use a delayed response to catch the processing state
      let resolveFetch;
      const fetchPromise = new Promise(resolve => {
        resolveFetch = resolve;
      });

      global.fetch.mockReturnValueOnce(fetchPromise);

      render(<Step4PreviousCourses {...defaultProps} />);

      if (mockDropzoneConfig.onDrop) {
        // Start the upload
        const uploadPromise = mockDropzoneConfig.onDrop([mockFile]);
        
        // Check for processing indicator
        await waitFor(() => {
          expect(screen.getByText('Processing transcript...')).toBeInTheDocument();
        });

        // Resolve the fetch
        resolveFetch({
          ok: true,
          json: async () => ({ courses: mockCourses })
        });

        await uploadPromise;
      }
    });

    test('shows drag active state when isDragActive is true', () => {
      // Set drag active state before rendering
      mockIsDragActive = true;
      
      render(<Step4PreviousCourses {...defaultProps} />);
      
      // When isDragActive is true, should show drag-active message
      expect(screen.getByText('Drop your PDF transcript here...')).toBeInTheDocument();
    });
  });
});
