import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

// Mock API functions
jest.mock('../api.jsx', () => ({
  searchUsers: jest.fn(),
  getUserPublicProfile: jest.fn(),
  getUserProfile: jest.fn(),
  adminDeleteUser: jest.fn(),
  adminToggleSuperUser: jest.fn()
}));

// Mock PlannerCalendar component
jest.mock('../PlannerCalendar.jsx', () => {
  return function MockPlannerCalendar({ plannedClasses, readOnly }) {
    return (
      <div data-testid="planner-calendar">
        <p>Planner Calendar (ReadOnly: {readOnly ? 'true' : 'false'})</p>
        <p>Classes: {plannedClasses?.length || 0}</p>
      </div>
    );
  };
});

// Mock CSS imports
jest.mock('../index.css', () => ({}));
jest.mock('../colors.css', () => ({}));

import UserSearch from '../UserSearch.jsx';
import * as api from '../api.jsx';

describe('UserSearch', () => {
  const mockUsers = [
    {
      _id: '1',
      name: 'John Doe',
      email: 'john.doe@vanderbilt.edu',
      major: 'Computer Science',
      year: 'Sophomore',
      dorm: 'Commons',
      isSuperUser: false
    },
    {
      _id: '2',
      name: 'Jane Smith',
      email: 'jane.smith@vanderbilt.edu',
      major: 'Mathematics',
      year: 'Junior',
      dorm: 'McTyeire Hall',
      isSuperUser: true
    },
    {
      _id: '3',
      name: 'Bob Johnson',
      email: 'bob.johnson@vanderbilt.edu',
      major: 'Computer Science',
      year: 'Freshman',
      dorm: null,
      isSuperUser: false
    }
  ];

  const mockPublicProfile = {
    _id: '1',
    name: 'John Doe',
    email: 'john.doe@vanderbilt.edu',
    major: 'Computer Science',
    year: 'Sophomore',
    dorm: 'Commons',
    isSuperUser: false,
    semesterPlan: {
      semesterName: 'Fall 2025',
      classes: [
        { code: 'CS 1101', name: 'Programming' },
        { code: 'MATH 1200', name: 'Calculus' }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    api.searchUsers.mockResolvedValue(mockUsers);
    api.getUserProfile.mockResolvedValue({ isSuperUser: false });
    api.getUserPublicProfile.mockResolvedValue(mockPublicProfile);
    api.adminDeleteUser.mockResolvedValue({});
    api.adminToggleSuperUser.mockResolvedValue({});
  });

  describe('Initial Render', () => {
    test('renders search page with header', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      expect(screen.getByText('Find Students')).toBeInTheDocument();
      expect(screen.getByText(/Search for other students and explore their semester schedules/)).toBeInTheDocument();
    });

    test('shows loading state initially', () => {
      api.searchUsers.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<UserSearch />);

      expect(screen.getByText('🔄 Loading users...')).toBeInTheDocument();
    });

    test('displays users after loading', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    test('displays user count', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText(/Students \(3\)/)).toBeInTheDocument();
      });
    });

    test('displays user information correctly', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john.doe@vanderbilt.edu')).toBeInTheDocument();
      });

      // Check that tags are present (may appear multiple times for different users)
      await waitFor(() => {
        const computerScienceTags = screen.getAllByText('Computer Science');
        expect(computerScienceTags.length).toBeGreaterThan(0);
        const sophomoreTags = screen.getAllByText('Sophomore');
        expect(sophomoreTags.length).toBeGreaterThan(0);
        const commonsTags = screen.getAllByText('🏠 Commons');
        expect(commonsTags.length).toBeGreaterThan(0);
      });
    });

    test('displays admin badge for superusers', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('ADMIN')).toBeInTheDocument();
      });
    });

    test('handles users without dorm', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        // Should not show dorm tag for users without dorm
        expect(screen.queryByText(/🏠.*Bob Johnson/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    test('updates search query on input change', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      fireEvent.change(searchInput, { target: { value: 'John' } });

      expect(searchInput.value).toBe('John');
    });

    test('performs search when search button is clicked', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      const searchButton = screen.getByText('🔍 Search');

      fireEvent.change(searchInput, { target: { value: 'John' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ query: 'John' });
      });
    });

    test('performs search on Enter key press', async () => {
      const user = userEvent.setup({ delay: null });
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await user.type(searchInput, 'John');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ query: 'John' });
      });
    });

    test('does not search with query less than 2 characters', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      api.searchUsers.mockClear();

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await waitFor(() => {
        const searchButton = screen.getByText('🔍 Search');
        expect(searchButton).toBeInTheDocument();
      });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.change(searchInput, { target: { value: 'J' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({});
      });
    });

    test('trims whitespace from search query', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      api.searchUsers.mockClear();

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await waitFor(() => {
        const searchButton = screen.getByText('🔍 Search');
        expect(searchButton).toBeInTheDocument();
      });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.change(searchInput, { target: { value: '  John  ' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ query: 'John' });
      });
    });

    test('disables search button while loading', async () => {
      api.searchUsers.mockImplementation(() => new Promise(() => {}));
      render(<UserSearch />);

      await waitFor(() => {
        const searchButtons = screen.getAllByText('🔄');
        expect(searchButtons.length).toBeGreaterThan(0);
        expect(searchButtons[0]).toBeDisabled();
      });
    });
  });

  describe('Filter Functionality', () => {
    test('toggles filter visibility', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      const filterButton = screen.getByText('Show filters');
      expect(screen.queryByLabelText('Class Year')).not.toBeInTheDocument();

      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Class Year')).toBeInTheDocument();
        expect(screen.getByText('Hide filters')).toBeInTheDocument();
      });
    });

    test('filters by year', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      api.searchUsers.mockClear();

      const filterButton = screen.getByText('Show filters');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Class Year')).toBeInTheDocument();
      });

      const yearSelect = screen.getByLabelText('Class Year');
      fireEvent.change(yearSelect, { target: { value: 'Sophomore' } });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ year: 'Sophomore' });
      });
    });

    test('filters by major', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      const filterButton = screen.getByText('Show filters');
      fireEvent.click(filterButton);

      const majorInput = screen.getByPlaceholderText('Filter by major...');
      fireEvent.change(majorInput, { target: { value: 'Computer Science' } });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ major: 'Computer Science' });
      });
    });

    test('filters by dorm', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      const filterButton = screen.getByText('Show filters');
      fireEvent.click(filterButton);

      const dormInput = screen.getByPlaceholderText('Filter by dorm...');
      fireEvent.change(dormInput, { target: { value: 'Commons' } });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ dorm: 'Commons' });
      });
    });

    test('combines multiple filters', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      api.searchUsers.mockClear();

      const filterButton = screen.getByText('Show filters');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Class Year')).toBeInTheDocument();
      });

      const yearSelect = screen.getByLabelText('Class Year');
      const majorInput = screen.getByPlaceholderText('Filter by major...');
      const dormInput = screen.getByPlaceholderText('Filter by dorm...');

      fireEvent.change(yearSelect, { target: { value: 'Sophomore' } });
      fireEvent.change(majorInput, { target: { value: 'Computer Science' } });
      fireEvent.change(dormInput, { target: { value: 'Commons' } });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({
          year: 'Sophomore',
          major: 'Computer Science',
          dorm: 'Commons'
        });
      });
    });

    test('clears all filters', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      api.searchUsers.mockClear();

      const filterButton = screen.getByText('Show filters');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Class Year')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      const yearSelect = screen.getByLabelText('Class Year');
      const majorInput = screen.getByPlaceholderText('Filter by major...');

      fireEvent.change(searchInput, { target: { value: 'John' } });
      fireEvent.change(yearSelect, { target: { value: 'Sophomore' } });
      fireEvent.change(majorInput, { target: { value: 'CS' } });

      // Clear filters by resetting them manually (simulating clear functionality)
      fireEvent.change(searchInput, { target: { value: '' } });
      fireEvent.change(yearSelect, { target: { value: '' } });
      fireEvent.change(majorInput, { target: { value: '' } });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({});
      });
    });

    test('handles Enter key in filter inputs', async () => {
      const user = userEvent.setup({ delay: null });
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      const filterButton = screen.getByText('Show filters');
      fireEvent.click(filterButton);

      const majorInput = screen.getByPlaceholderText('Filter by major...');
      await user.type(majorInput, 'Computer Science');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ major: 'Computer Science' });
      });
    });
  });

  describe('User Selection', () => {
    test('selects user and shows profile', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(api.getUserPublicProfile).toHaveBeenCalledWith('1');
      });

      await waitFor(() => {
        expect(screen.getByText('← Back to Search')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john.doe@vanderbilt.edu')).toBeInTheDocument();
      });
    });

    test('displays user profile information', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText('📚 Computer Science')).toBeInTheDocument();
        expect(screen.getByText('🎓 Sophomore')).toBeInTheDocument();
        expect(screen.getByText('🏠 Commons')).toBeInTheDocument();
      });
    });

    test('displays user semester plan', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText(/📅 Fall 2025/)).toBeInTheDocument();
        expect(screen.getByText(/\(2 classes\)/)).toBeInTheDocument();
        expect(screen.getByText('CS 1101')).toBeInTheDocument();
        expect(screen.getByText('MATH 1200')).toBeInTheDocument();
      });
    });

    test('displays PlannerCalendar for user with classes', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByTestId('planner-calendar')).toBeInTheDocument();
      });
    });

    test('shows message when user has no classes', async () => {
      const profileWithoutClasses = {
        ...mockPublicProfile,
        semesterPlan: {
          semesterName: 'Fall 2025',
          classes: []
        }
      };

      api.getUserPublicProfile.mockResolvedValueOnce(profileWithoutClasses);

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText(/This user hasn't planned any classes yet/)).toBeInTheDocument();
      });
    });

    test('handles back button to return to search', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText('← Back to Search')).toBeInTheDocument();
      });

      const backButton = screen.getByText('← Back to Search');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Find Students')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    test('handles error loading user profile', async () => {
      api.getUserPublicProfile.mockRejectedValueOnce(new Error('Failed to load profile'));

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load profile/)).toBeInTheDocument();
      });
    });
  });

  describe('Admin Functionality', () => {
    test('shows admin mode badge when user is superuser', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('Admin Mode')).toBeInTheDocument();
      });
    });

    test('shows admin buttons for superusers', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await waitFor(() => {
        const adminButtons = screen.getAllByText('Make Admin');
        expect(adminButtons.length).toBeGreaterThan(0);
        const deleteButtons = screen.getAllByText('🗑️ Delete');
        expect(deleteButtons.length).toBeGreaterThan(0);
      });
    });

    test('shows Remove Admin button for superusers', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      expect(screen.getByText('Remove Admin')).toBeInTheDocument();
    });

    test('shows confirmation modal when deleting user', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find delete button within John Doe's card
      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButton = johnDoeCard.querySelector('button');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
        expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
      });
    });

    test('deletes user after confirmation', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.adminDeleteUser).toHaveBeenCalledWith('1');
      });

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    test('cancels delete when clicking cancel', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('No, Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Delete John Doe\?/)).not.toBeInTheDocument();
      });

      expect(api.adminDeleteUser).not.toHaveBeenCalled();
    });

    test('shows toast notification after successful delete', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Deleted John Doe/)).toBeInTheDocument();
      });
    });

    test('shows error toast when delete fails', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });
      api.adminDeleteUser.mockRejectedValueOnce(new Error('Delete failed'));

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete: Delete failed/)).toBeInTheDocument();
      });
    });

    test('shows confirmation modal when toggling superuser', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const makeAdminButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('Make Admin'));
      fireEvent.click(makeAdminButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/grant admin access to John Doe/)).toBeInTheDocument();
      });
    });

    test('toggles superuser status after confirmation', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const makeAdminButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('Make Admin'));
      fireEvent.click(makeAdminButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/grant admin access to John Doe/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.adminToggleSuperUser).toHaveBeenCalledWith('1', true);
      });
    });

    test('removes admin access after confirmation', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      const janeSmithCard = screen.getByText('Jane Smith').closest('.user-card');
      const removeAdminButtons = Array.from(janeSmithCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('Remove Admin'));
      fireEvent.click(removeAdminButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/remove admin access from Jane Smith/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.adminToggleSuperUser).toHaveBeenCalledWith('2', false);
      });
    });

    test('updates user list after toggle superuser', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const makeAdminButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('Make Admin'));
      fireEvent.click(makeAdminButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/grant admin access to John Doe/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully updated John Doe/)).toBeInTheDocument();
      });
    });

    test('updates selected user profile after toggle superuser', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText('← Back to Search')).toBeInTheDocument();
      });

      // Go back and toggle admin
      const backButton = screen.getByText('← Back to Search');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const makeAdminButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('Make Admin'));
      fireEvent.click(makeAdminButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/grant admin access to John Doe/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.adminToggleSuperUser).toHaveBeenCalled();
      });
    });

    test('shows error toast when toggle superuser fails', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });
      api.adminToggleSuperUser.mockRejectedValueOnce(new Error('Toggle failed'));

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const makeAdminButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('Make Admin'));
      fireEvent.click(makeAdminButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/grant admin access to John Doe/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed: Toggle failed/)).toBeInTheDocument();
      });
    });

    test('does not show admin buttons for non-superusers', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: false });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByText('Make Admin')).not.toBeInTheDocument();
        expect(screen.queryByText('🗑️ Delete')).not.toBeInTheDocument();
        const arrows = screen.getAllByText('→');
        expect(arrows.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message when search fails', async () => {
      api.searchUsers.mockRejectedValueOnce(new Error('Search failed'));

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText(/Search failed/)).toBeInTheDocument();
      });
    });

    test('displays error message when no users found', async () => {
      api.searchUsers.mockResolvedValueOnce([]);

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });
    });

    test('handles error loading superuser status', async () => {
      api.getUserProfile.mockRejectedValueOnce(new Error('Profile load failed'));

      render(<UserSearch />);

      await waitFor(() => {
        // Component should still render even if superuser check fails
        expect(screen.getByText('Find Students')).toBeInTheDocument();
      });
    });

    test('handles error with no message', async () => {
      api.searchUsers.mockRejectedValueOnce({});

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load users/)).toBeInTheDocument();
      });
    });
  });

  describe('Toast Notifications', () => {
    test('shows success toast', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Deleted John Doe/)).toBeInTheDocument();
      });
    });

    test('shows error toast', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });
      api.adminDeleteUser.mockRejectedValueOnce(new Error('Delete failed'));

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        const toast = screen.getByText(/Failed to delete: Delete failed/);
        expect(toast).toBeInTheDocument();
      });
    });

    test('auto-dismisses toast after 3 seconds', async () => {
      jest.useFakeTimers();
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('🗑️ Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText("Yes, I'm Sure");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Deleted John Doe/)).toBeInTheDocument();
      });

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Deleted John Doe/)).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty search results', async () => {
      api.searchUsers.mockResolvedValueOnce([]);

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });

      // Should not show "Students" header when no results
      expect(screen.queryByText(/Students \(\d+\)/)).not.toBeInTheDocument();
    });


    test('handles user with undefined semesterPlan classes', async () => {
      const profileWithUndefinedClasses = {
        ...mockPublicProfile,
        semesterPlan: {
          semesterName: 'Fall 2025',
          classes: undefined
        }
      };

      api.getUserPublicProfile.mockResolvedValueOnce(profileWithUndefinedClasses);

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText(/\(0 classes\)/)).toBeInTheDocument();
      });
    });

    test('handles user profile with missing fields', async () => {
      const minimalProfile = {
        _id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        semesterPlan: {
          semesterName: 'Fall 2025',
          classes: []
        }
      };

      api.getUserPublicProfile.mockResolvedValueOnce(minimalProfile);

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
      });
    });

    test('handles search with only filters and no query', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalled();
      });

      api.searchUsers.mockClear();

      const filterButton = screen.getByText('Show filters');
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Class Year')).toBeInTheDocument();
      });

      const yearSelect = screen.getByLabelText('Class Year');
      fireEvent.change(yearSelect, { target: { value: 'Sophomore' } });

      const searchButton = screen.getByText('🔍 Search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.searchUsers).toHaveBeenCalledWith({ year: 'Sophomore' });
      });
    });

    test('handles user avatar with empty name', async () => {
      const userWithEmptyName = {
        ...mockUsers[0],
        name: ''
      };

      api.searchUsers.mockResolvedValueOnce([userWithEmptyName]);

      render(<UserSearch />);

      await waitFor(() => {
        // Component should handle empty name gracefully
        expect(api.searchUsers).toHaveBeenCalled();
      });
    });

    test('stops event propagation on admin button clicks', async () => {
      api.getUserProfile.mockResolvedValue({ isSuperUser: true });

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const johnDoeCard = screen.getByText('John Doe').closest('.user-card');
      const deleteButtons = Array.from(johnDoeCard.querySelectorAll('button')).filter(btn => btn.textContent.includes('🗑️'));
      fireEvent.click(deleteButtons[0]);

      // Should show modal, not select user
      await waitFor(() => {
        expect(screen.getByText(/Delete John Doe\?/)).toBeInTheDocument();
      });

      // User should not be selected
      expect(screen.queryByText('← Back to Search')).not.toBeInTheDocument();
    });
  });

  describe('User Profile Display', () => {
    test('displays user avatar initial', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        // Avatar should show first letter of name
        const avatar = screen.getByText('J');
        expect(avatar).toBeInTheDocument();
      });
    });

    test('displays all user tags in profile', async () => {
      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText('📚 Computer Science')).toBeInTheDocument();
        expect(screen.getByText('🎓 Sophomore')).toBeInTheDocument();
        expect(screen.getByText('🏠 Commons')).toBeInTheDocument();
      });
    });

    test('displays admin tag for superuser in profile', async () => {
      const superUserProfile = {
        ...mockPublicProfile,
        isSuperUser: true
      };

      api.getUserPublicProfile.mockResolvedValueOnce(superUserProfile);

      render(<UserSearch />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userCard = screen.getByText('John Doe').closest('.user-card');
      fireEvent.click(userCard);

      await waitFor(() => {
        expect(screen.getByText('ADMIN')).toBeInTheDocument();
      });
    });
  });
});

