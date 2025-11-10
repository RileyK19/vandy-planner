import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../api', () => require('../__mocks__/api.jsx'));

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

    expect(screen.getByLabelText('Major *').value).toBe('Computer Science');
    expect(screen.getByLabelText('Academic Year *').value).toBe('Junior');
    expect(screen.getByLabelText('Dorm Location *').value).toBe('Gillette House');
    expect(screen.getByText('Added Courses (1)')).toBeInTheDocument();
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

  test('adds a previous course to the list', async () => {
    render(<ProfilePage user={mockUser} onProfileUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText('e.g., CS 1101'), { target: { value: 'CS 2201' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., Programming and Problem Solving'), { target: { value: 'Data Structures' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., Fall 2023'), { target: { value: 'Spring 2024' } });

    fireEvent.click(screen.getByText('Add Course'));

    expect(screen.getByText('Added Courses (2)')).toBeInTheDocument();
    expect(screen.getByText('CS 2201')).toBeInTheDocument();
  });

  test('saves profile updates successfully', async () => {
    const onProfileUpdate = jest.fn();

    render(<ProfilePage user={mockUser} onProfileUpdate={onProfileUpdate} />);

    await waitFor(() => {
      expect(api.getUserProfile).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Dorm Location *'), { target: { value: 'Lewis House' } });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.updateUserProfile).toHaveBeenCalledWith({
        major: 'Computer Science',
        year: 'Junior',
        dorm: 'Lewis House',
        previousCourses: [{ courseCode: 'CS 1101', term: 'Fall 2023' }]
      });
    });

    expect(onProfileUpdate).toHaveBeenCalledWith(loadedProfile);
    expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
  });
});
