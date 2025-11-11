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
    expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
  });

  test('shows load error when fetching profile fails', async () => {
    api.getUserProfile.mockRejectedValueOnce(new Error('load failed'));

    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    expect(await screen.findByText('Failed to load profile data')).toBeInTheDocument();
  });

  test('shows validation error when adding incomplete course', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Add Course'));

    expect(screen.getByText('Please fill in course code and term')).toBeInTheDocument();
    expect(screen.getByText('Added Courses (1)')).toBeInTheDocument();
  });

  test('removes an existing course from the list', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Added Courses (1)')).toBeInTheDocument();
    });

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(screen.queryByText('Added Courses (1)')).not.toBeInTheDocument();
  });

  test('handles update errors gracefully', async () => {
    api.updateUserProfile.mockRejectedValueOnce(new Error('Server failure'));

    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    await screen.findByDisplayValue('Gillette House');

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.updateUserProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Server failure')).toBeInTheDocument();
    });
  });

  test('clears success message after timeout', async () => {
    jest.useFakeTimers();
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    await screen.findByDisplayValue('Gillette House');

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.updateUserProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(screen.queryByText('Profile updated successfully!')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});