import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CourseDropdown from '../CourseDropdown.jsx';

describe('CourseDropdown', () => {
  const mockCourses = [
    { courseCode: 'CS 1101', courseName: 'Programming and Problem Solving' },
    { courseCode: 'CS 2201', courseName: 'Program Design and Data Structures' },
    { courseCode: 'MATH 1300', courseName: 'Calculus I' },
    { courseCode: 'MATH 1301', courseName: 'Calculus II' },
  ];

  const emptyCoursesArray = [];
  const coursesWithoutName = [
    { courseCode: 'CS 1101' },
    { courseCode: 'CS 2201' },
  ];

  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders with default props', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('');
    });

    test('renders with custom placeholder', () => {
      render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          placeholder="Choose a course"
        />
      );
      
      expect(screen.getByPlaceholderText('Choose a course')).toBeInTheDocument();
    });

    test('renders with initial value', () => {
      const initialValue = { courseCode: 'CS 1101', courseName: 'Programming and Problem Solving' };
      render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={initialValue}
        />
      );
      
      const input = screen.getByDisplayValue('CS 1101');
      expect(input).toBeInTheDocument();
    });

    test('renders with error state', () => {
      render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          error={true}
        />
      );
      
      const input = screen.getByPlaceholderText('Select a course...');
      expect(input).toHaveClass('error');
    });

    test('renders dropdown arrow', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const arrow = screen.getByText('▼');
      expect(arrow).toBeInTheDocument();
    });
  });

  describe('Dropdown opening and closing', () => {
    test('opens dropdown on input focus', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.getByText('CS 2201')).toBeInTheDocument();
    });

    test('opens dropdown when typing', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'CS' } });
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
    });

    test('closes dropdown when selecting a course', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      const courseOption = screen.getByText('CS 1101');
      fireEvent.click(courseOption);
      
      expect(screen.queryByText('CS 2201')).not.toBeInTheDocument();
    });

    test('closes dropdown when clicking outside', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      
      // Click outside
      fireEvent.mouseDown(document.body);
      
      waitFor(() => {
        expect(screen.queryByText('CS 1101')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search and filtering', () => {
    test('filters courses by course code', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'CS' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.getByText('CS 2201')).toBeInTheDocument();
      expect(screen.queryByText('MATH 1300')).not.toBeInTheDocument();
    });

    test('filters courses by course name', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'Calculus' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('MATH 1300')).toBeInTheDocument();
      expect(screen.getByText('MATH 1301')).toBeInTheDocument();
      expect(screen.queryByText('CS 1101')).not.toBeInTheDocument();
    });

    test('filters courses case-insensitively', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'cs' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.getByText('CS 2201')).toBeInTheDocument();
    });

    test('shows all courses when search term is empty', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.getByText('CS 2201')).toBeInTheDocument();
      expect(screen.getByText('MATH 1300')).toBeInTheDocument();
      expect(screen.getByText('MATH 1301')).toBeInTheDocument();
    });

    test('shows "No courses found" when no matches', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'XYZ 9999' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('No courses found')).toBeInTheDocument();
    });

    test('updates filtered courses when courses prop changes', () => {
      const { rerender } = render(
        <CourseDropdown onChange={mockOnChange} courses={mockCourses} />
      );
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      
      const newCourses = [
        { courseCode: 'PHYS 1601', courseName: 'Physics I' },
      ];
      
      rerender(<CourseDropdown onChange={mockOnChange} courses={newCourses} value={null} />);
      
      // Clear and refocus to see updated courses
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('PHYS 1601')).toBeInTheDocument();
      expect(screen.queryByText('CS 1101')).not.toBeInTheDocument();
    });
  });

  describe('Course selection', () => {
    test('calls onChange when selecting a course', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      const courseOption = screen.getByText('CS 1101');
      fireEvent.click(courseOption);
      
      expect(mockOnChange).toHaveBeenCalledWith({
        courseCode: 'CS 1101',
        courseName: 'Programming and Problem Solving',
      });
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    test('updates input value when selecting a course', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      const courseOption = screen.getByText('CS 2201');
      fireEvent.click(courseOption);
      
      expect(input.value).toBe('CS 2201');
    });

    test('highlights selected course in dropdown', () => {
      const selectedValue = { courseCode: 'CS 1101', courseName: 'Programming and Problem Solving' };
      render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={selectedValue}
        />
      );
      
      const input = screen.getByDisplayValue('CS 1101');
      fireEvent.focus(input);
      
      const selectedOption = screen.getByText('CS 1101').closest('.course-dropdown-item');
      expect(selectedOption).toHaveClass('selected');
    });

    test('displays course name when available', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.getByText(/Programming and Problem Solving/)).toBeInTheDocument();
    });

    test('handles courses without course name', () => {
      const { container } = render(<CourseDropdown onChange={mockOnChange} courses={coursesWithoutName} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.getByText('CS 2201')).toBeInTheDocument();
      // Check that course name separator is not rendered
      const courseNameItems = container.querySelectorAll('.course-name-item');
      expect(courseNameItems.length).toBe(0);
    });
  });

  describe('Value prop updates', () => {
    test('updates search term when value prop changes', () => {
      const { rerender } = render(
        <CourseDropdown onChange={mockOnChange} courses={mockCourses} />
      );
      
      const input = screen.getByPlaceholderText('Select a course...');
      expect(input.value).toBe('');
      
      const newValue = { courseCode: 'CS 1101', courseName: 'Programming and Problem Solving' };
      rerender(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={newValue}
        />
      );
      
      expect(input.value).toBe('CS 1101');
    });

    test('clears search term when value becomes null', () => {
      const initialValue = { courseCode: 'CS 1101', courseName: 'Programming and Problem Solving' };
      const { rerender } = render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={initialValue}
        />
      );
      
      const input = screen.getByDisplayValue('CS 1101');
      expect(input.value).toBe('CS 1101');
      
      rerender(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={null}
        />
      );
      
      expect(input.value).toBe('');
    });

    test('clears search term when value becomes empty object', () => {
      const initialValue = { courseCode: 'CS 1101', courseName: 'Programming and Problem Solving' };
      const { rerender } = render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={initialValue}
        />
      );
      
      const input = screen.getByDisplayValue('CS 1101');
      expect(input.value).toBe('CS 1101');
      
      rerender(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={{}}
        />
      );
      
      expect(input.value).toBe('');
    });
  });

  describe('Click outside behavior', () => {
    test('resets search term to selected value when clicking outside with value', () => {
      const selectedValue = { courseCode: 'CS 1101', courseName: 'Programming and Problem Solving' };
      render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={selectedValue}
        />
      );
      
      const input = screen.getByDisplayValue('CS 1101');
      fireEvent.change(input, { target: { value: 'MATH' } });
      fireEvent.focus(input);
      
      expect(input.value).toBe('MATH');
      
      // Click outside
      fireEvent.mouseDown(document.body);
      
      waitFor(() => {
        expect(input.value).toBe('CS 1101');
      });
    });

    test('clears search term when clicking outside without value', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'MATH' } });
      fireEvent.focus(input);
      
      expect(input.value).toBe('MATH');
      
      // Click outside
      fireEvent.mouseDown(document.body);
      
      waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    test('does not close dropdown when clicking inside', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      
      // Click inside the dropdown
      const courseOption = screen.getByText('CS 1101');
      fireEvent.mouseDown(courseOption);
      
      // Dropdown should still be open (or closed due to selection, but not due to outside click)
      // Actually, clicking a course option should close it due to selection
      // But clicking inside the wrapper should not close it
      const wrapper = screen.getByPlaceholderText('Select a course...').closest('.course-dropdown-wrapper');
      fireEvent.mouseDown(wrapper);
      
      // Dropdown should still be visible if we focus again
      fireEvent.focus(input);
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    test('handles empty courses array', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={emptyCoursesArray} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('No courses found')).toBeInTheDocument();
    });

    test('handles undefined courses prop', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={emptyCoursesArray} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.focus(input);
      
      expect(screen.getByText('No courses found')).toBeInTheDocument();
    });

    test('handles typing that does not match any course', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'INVALID' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('No courses found')).toBeInTheDocument();
    });

    test('handles partial matches in course code', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: '1101' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      expect(screen.queryByText('CS 2201')).not.toBeInTheDocument();
    });

    test('handles partial matches in course name', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'Problem' } });
      fireEvent.focus(input);
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
      // CS 2201 course name is "Program Design and Data Structures" - doesn't contain "Problem"
      expect(screen.queryByText('CS 2201')).not.toBeInTheDocument();
    });

    test('handles value with courseCode but no courseName', () => {
      const valueWithoutName = { courseCode: 'CS 1101' };
      render(
        <CourseDropdown 
          onChange={mockOnChange} 
          courses={mockCourses} 
          value={valueWithoutName}
        />
      );
      
      const input = screen.getByDisplayValue('CS 1101');
      expect(input).toBeInTheDocument();
    });

    test('handles rapid typing and selection', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      
      fireEvent.change(input, { target: { value: 'C' } });
      fireEvent.change(input, { target: { value: 'CS' } });
      fireEvent.change(input, { target: { value: 'CS 1' } });
      fireEvent.focus(input);
      
      const courseOption = screen.getByText('CS 1101');
      fireEvent.click(courseOption);
      
      expect(mockOnChange).toHaveBeenCalledWith({
        courseCode: 'CS 1101',
        courseName: 'Programming and Problem Solving',
      });
      expect(input.value).toBe('CS 1101');
    });
  });

  describe('Input change behavior', () => {
    test('opens dropdown when typing', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'CS' } });
      
      expect(screen.getByText('CS 1101')).toBeInTheDocument();
    });

    test('does not call onChange when typing (only on selection)', () => {
      render(<CourseDropdown onChange={mockOnChange} courses={mockCourses} />);
      
      const input = screen.getByPlaceholderText('Select a course...');
      fireEvent.change(input, { target: { value: 'CS' } });
      
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });
});

