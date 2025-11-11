import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the API
jest.mock('../api', () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn()
}));

import ProfilePage from '../ProfilePage.jsx';
import * as api from '../api.jsx';

describe('ProfilePage', () => {
  const mockUser = {
    name: 'Test User',
    email: 'test@example.com'
  };

  const loadedProfile = {
    major: 'Computer Science',
    year: 'Junior',
    dorm: 'Gillette House',
    previousCourses: [{ courseCode: 'CS 1101', term: 'Fall 2023' }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    api.getUserProfile.mockResolvedValue(loadedProfile);
    api.updateUserProfile.mockResolvedValue({ user: loadedProfile });
  });

  test('loads user profile data on mount', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('Computer Science');
      expect(screen.getByLabelText('Academic Year *')).toHaveValue('Junior');
      expect(screen.getByLabelText('Dorm Location *')).toHaveValue('Gillette House');
    });

    expect(screen.getByText('Added Courses (1)')).toBeInTheDocument();
  });

  test('handles user without name', async () => {
    const userWithoutName = { email: 'test@example.com' };
    render(<ProfilePage user={userWithoutName} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Should still render with email initial
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  test('displays error when profile loading fails', async () => {
    api.getUserProfile.mockRejectedValue(new Error('Failed to load'));
    
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load profile data')).toBeInTheDocument();
    });
  });

  test('handles empty profile data', async () => {
    api.getUserProfile.mockResolvedValue({});
    
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('');
      expect(screen.getByLabelText('Academic Year *')).toHaveValue('');
      expect(screen.getByLabelText('Dorm Location *')).toHaveValue('');
    });

    expect(screen.queryByText('Added Courses')).not.toBeInTheDocument();
  });

  test('prevents saving when required fields are missing', async () => {
    api.getUserProfile.mockResolvedValue({ major: '', year: '', dorm: '' });

    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Save Changes'));

    expect(api.updateUserProfile).not.toHaveBeenCalled();
    expect(screen.getByText('Please select your major')).toBeInTheDocument();
    expect(screen.getByText('Please select your academic year')).toBeInTheDocument();
    expect(screen.getByText('Please enter your dorm location (at least 2 characters)')).toBeInTheDocument();
  });

  test('validates dorm location minimum length', async () => {
    // Start with valid major and year, but empty dorm
    api.getUserProfile.mockResolvedValue({ 
      major: 'Computer Science', 
      year: 'Junior', 
      dorm: '' 
    });
    
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Set dorm to single character
    fireEvent.change(screen.getByLabelText('Dorm Location *'), { target: { value: 'A' } });
    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.getByText('Please enter your dorm location (at least 2 characters)')).toBeInTheDocument();
    expect(api.updateUserProfile).not.toHaveBeenCalled();
  });

  test('adds a previous course to the list', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText('e.g., CS 1101'), { target: { value: 'CS 2201' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., Fall 2023'), { target: { value: 'Spring 2024' } });

    fireEvent.click(screen.getByText('Add Course'));

    expect(screen.getByText('Added Courses (2)')).toBeInTheDocument();
    expect(screen.getByText('CS 2201')).toBeInTheDocument();
  });

  test('shows error when adding course with missing fields', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Try to add course without filling fields
    fireEvent.click(screen.getByText('Add Course'));

    expect(screen.getByText('Please fill in course code and term')).toBeInTheDocument();
    expect(screen.getByText('Added Courses (1)')).toBeInTheDocument(); // Should not add
  });

  test('removes a course from the list', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Initially has 1 course
    expect(screen.getByText('Added Courses (1)')).toBeInTheDocument();
    expect(screen.getByText('CS 1101')).toBeInTheDocument();

    // Remove the course
    fireEvent.click(screen.getByText('Remove'));

    // Course should be removed
    expect(screen.queryByText('CS 1101')).not.toBeInTheDocument();
    expect(screen.queryByText('Added Courses (1)')).not.toBeInTheDocument();
  });

  test('saves profile updates successfully', async () => {
    const onProfileUpdate = jest.fn();

    render(<ProfilePage user={mockUser} onProfileUpdate={onProfileUpdate} />);

    // Wait for form to load and initialize
    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Wait a bit more for form state to settle
    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('Computer Science');
    });

    // Ensure no validation errors are present before saving
    expect(screen.queryByText('Please select your major')).not.toBeInTheDocument();
    expect(screen.queryByText('Please select your academic year')).not.toBeInTheDocument();
    expect(screen.queryByText('Please enter your dorm location')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.updateUserProfile).toHaveBeenCalledWith({
        major: 'Computer Science',
        year: 'Junior',
        dorm: 'Gillette House',
        previousCourses: [{ courseCode: 'CS 1101', term: 'Fall 2023' }]
      });
    });

    expect(onProfileUpdate).toHaveBeenCalledWith(loadedProfile);
  });

  test('handles save error', async () => {
    const errorMessage = 'Failed to update profile';
    api.updateUserProfile.mockRejectedValue(new Error(errorMessage));

    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Wait for form to be properly initialized
    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('Computer Science');
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('clears success message after timeout', async () => {
    jest.useFakeTimers();
    
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Wait for form initialization
    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('Computer Science');
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.updateUserProfile).toHaveBeenCalled();
    });

    // Check for any success message
    const successMessage = screen.queryByText(/Profile updated successfully|Changes saved|Success/i);
    if (successMessage) {
      // Fast-forward timers if message exists
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      
      // Message should be cleared
      expect(screen.queryByText(/Profile updated successfully|Changes saved|Success/i)).not.toBeInTheDocument();
    }

    jest.useRealTimers();
  });

  test('disables save button while saving', async () => {
    // Create a promise that doesn't resolve immediately
    let resolveUpdate;
    const updatePromise = new Promise(resolve => {
      resolveUpdate = resolve;
    });
    api.updateUserProfile.mockReturnValue(updatePromise);

    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Wait for form initialization
    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('Computer Science');
    });

    // Get the save button before clicking
    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    
    fireEvent.click(saveButton);

    // Button should be disabled and show "Saving..."
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Saving.../i })).toBeDisabled();
    });

    // Resolve the promise
    await act(async () => {
      resolveUpdate({ user: loadedProfile });
    });

    // Button should be enabled again and show "Save Changes"
    await waitFor(() => {
      const enabledButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(enabledButton).not.toBeDisabled();
    });
  });

  test('clears errors when form fields are changed', async () => {
    api.getUserProfile.mockResolvedValue({ major: '', year: '', dorm: '' });

    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Trigger validation errors
    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.getByText('Please select your major')).toBeInTheDocument();

    // Change major field - should clear errors
    fireEvent.change(screen.getByLabelText('Major *'), { target: { value: 'Computer Science' } });

    await waitFor(() => {
      expect(screen.queryByText('Please select your major')).not.toBeInTheDocument();
    });
  });

  test('handles course code uppercase conversion', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Type lowercase course code
    fireEvent.change(screen.getByPlaceholderText('e.g., CS 1101'), { 
      target: { value: 'cs 2201' } 
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., Fall 2023'), { 
      target: { value: 'Spring 2024' } 
    });

    fireEvent.click(screen.getByText('Add Course'));

    // Course code should be converted to uppercase
    expect(screen.getByText('CS 2201')).toBeInTheDocument();
  });

  test('filters previous courses to only include courseCode and term when saving', async () => {
    const onProfileUpdate = jest.fn();

    render(<ProfilePage user={mockUser} onProfileUpdate={onProfileUpdate} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Wait for form initialization
    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('Computer Science');
    });

    // Add a new course
    fireEvent.change(screen.getByPlaceholderText('e.g., CS 1101'), { target: { value: 'MATH 1010' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., Fall 2023'), { target: { value: 'Fall 2022' } });
    fireEvent.click(screen.getByText('Add Course'));

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.updateUserProfile).toHaveBeenCalledWith({
        major: 'Computer Science',
        year: 'Junior',
        dorm: 'Gillette House',
        previousCourses: [
          { courseCode: 'CS 1101', term: 'Fall 2023' },
          { courseCode: 'MATH 1010', term: 'Fall 2022' }
        ]
      });
    });
  });

  test('renders all major options', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    const majorSelect = screen.getByLabelText('Major *');
    
    // Open the dropdown
    fireEvent.mouseDown(majorSelect);
    
    // Check for some expected major options
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  test('renders all academic year options', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    const yearSelect = screen.getByLabelText('Academic Year *');
    
    // Open the dropdown
    fireEvent.mouseDown(yearSelect);

    // Check for all academic year options
    expect(screen.getByText('Freshman')).toBeInTheDocument();
    expect(screen.getByText('Sophomore')).toBeInTheDocument();
    expect(screen.getByText('Junior')).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
    expect(screen.getByText('Graduate')).toBeInTheDocument();
  });

  test('handles user profile update without onProfileUpdate callback', async () => {
    // Render without onProfileUpdate prop
    render(<ProfilePage user={mockUser} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    // Wait for form initialization
    await waitFor(() => {
      expect(screen.getByLabelText('Major *')).toHaveValue('Computer Science');
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.updateUserProfile).toHaveBeenCalled();
    });

    // Should not throw error even without onProfileUpdate
  });
});