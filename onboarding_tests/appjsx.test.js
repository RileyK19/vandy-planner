import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Just tell Jest to use the manual mocks - it will automatically find them in __mocks__
jest.mock('../client/src/api.jsx');
jest.mock('../client/src/RecommendationEngine.jsx');
jest.mock('../client/src/RecommendationEngineFourYear.jsx');

// Mock CSS imports
jest.mock('../client/src/App.css', () => ({}));
jest.mock('../client/src/LoginPage.css', () => ({}));

// Mock child components (keep these since they're not in __mocks__)
jest.mock('../client/src/PlannerCalendar.jsx', () => {
  return function MockPlannerCalendar({ plannedClasses, onRemoveClass, onSavePlan }) {
    return (
      <div data-testid="planner-calendar">
        <h2>Planner Calendar</h2>
        <div>Planned Classes: {plannedClasses.length}</div>
        <button onClick={onSavePlan}>Save Plan</button>
        {plannedClasses.map(cls => (
          <div key={cls.id}>
            <span>{cls.code}</span>
            <button onClick={() => onRemoveClass(cls.id)}>Remove</button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../client/src/LoginPage.jsx', () => {
  return function MockLoginPage({ onLogin, onSignup }) {
    return (
      <div data-testid="login-page">
        <h2>Login Page</h2>
        <button onClick={() => onLogin({ email: 'test@example.com', name: 'Test User' })}>
          Mock Login
        </button>
        <button onClick={() => onSignup({ email: 'new@example.com', name: 'New User' })}>
          Mock Signup
        </button>
      </div>
    );
  };
});

jest.mock('../client/src/SearchPage.jsx', () => {
  return function MockSearchPage({ allClasses, onAddToPlanner, semesterPlans, onAddToSemester }) {
    return (
      <div data-testid="search-page">
        <h2>Search Page</h2>
        <div>Available Classes: {allClasses.length}</div>
        <button onClick={() => allClasses.length > 0 && onAddToPlanner(allClasses[0])}>
          Add First Class
        </button>
        <button onClick={() => allClasses.length > 0 && onAddToSemester('Fall 2024', allClasses[0])}>
          Add to Semester
        </button>
      </div>
    );
  };
});

jest.mock('../client/src/DegreeAudit.jsx', () => {
  return function MockDegreeAudit({ plannedClasses, major, userEmail, semesterPlans }) {
    return (
      <div data-testid="degree-audit">
        <h2>Degree Audit</h2>
        <div>Major: {major}</div>
        <div>Planned Classes: {plannedClasses.length}</div>
      </div>
    );
  };
});

jest.mock('../client/src/RecommendMe.jsx', () => {
  return function MockRecommendMe({ major, userEmail, plannedClasses, onAddToPlanner }) {
    return (
      <div data-testid="recommend-me">
        <h2>Recommendations</h2>
        <div>Major: {major}</div>
      </div>
    );
  };
});

jest.mock('../client/src/FourYearPlanner.jsx', () => {
  return function MockFourYearPlanner({ allClasses, onSavePlan, semesterPlans, onUpdateSemesterPlans }) {
    return (
      <div data-testid="four-year-planner">
        <h2>Four Year Planner</h2>
        <button onClick={() => onSavePlan({ futureCourses: [] })}>Save Plan</button>
      </div>
    );
  };
});

jest.mock('../client/src/Modal.jsx', () => {
  return function MockModal({ children, onClose }) {
    return (
      <div data-testid="modal" className="modal">
        <div className="modal-content">
          <button onClick={onClose} className="close-button" data-testid="modal-close">
            Close
          </button>
          {children}
        </div>
      </div>
    );
  };
});

// NOW import App and api
import App from '../client/src/App.jsx';
import * as api from '../client/src/api.jsx';

describe('App Component', () => {
  const mockClasses = [
    {
      id: '1',
      code: 'CS 1101',
      name: 'Intro to Programming',
      subject: 'Computer Science',
      hours: 3,
      professors: ['Prof. Smith'],
      term: 'Fall 2024',
      schedule: {
        days: ['M', 'W'],
        startTime: '10:00',
        endTime: '11:15'
      }
    },
    {
      id: '2',
      code: 'CS 2201',
      name: 'Data Structures',
      subject: 'Computer Science',
      hours: 3,
      professors: ['Prof. Johnson'],
      term: 'Spring 2025',
      schedule: {
        days: ['T', 'Th'],
        startTime: '13:00',
        endTime: '14:15'
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Setup default mock implementations
    api.fetchClassesWithRatings.mockResolvedValue(mockClasses);
    api.getUserProfile.mockResolvedValue({
      email: 'test@example.com',
      name: 'Test User',
      major: 'Computer Science',
      plannedSchedules: []
    });
  });

  describe('App Component', () => {
    const mockClasses = [
      {
        id: '1',
        code: 'CS 1101',
        name: 'Intro to Programming',
        subject: 'Computer Science',
        hours: 3,
        professors: ['Prof. Smith'],
        term: 'Fall 2024',
        schedule: {
          days: ['M', 'W'],
          startTime: '10:00',
          endTime: '11:15'
        }
      },
      {
        id: '2',
        code: 'CS 2201',
        name: 'Data Structures',
        subject: 'Computer Science',
        hours: 3,
        professors: ['Prof. Johnson'],
        term: 'Spring 2025',
        schedule: {
          days: ['T', 'Th'],
          startTime: '13:00',
          endTime: '14:15'
        }
      }
    ];
  
    beforeEach(() => {
      jest.clearAllMocks();
      localStorage.clear();
      
      // Setup default mock implementations
      api.fetchClassesWithRatings.mockResolvedValue(mockClasses);
      api.getUserProfile.mockResolvedValue({
        email: 'test@example.com',
        name: 'Test User',
        major: 'Computer Science',
        plannedSchedules: []
      });
    });
  
    describe('Authentication Flow', () => {
      test('shows login page when not authenticated', () => {
        localStorage.removeItem('token');
        render(<App />);
        
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
  
      test('handles login successfully', async () => {
        localStorage.removeItem('token');
        render(<App />);
  
        const loginButton = screen.getByText('Mock Login');
        fireEvent.click(loginButton);
  
        await waitFor(() => {
          expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
          expect(screen.getByTestId('search-page')).toBeInTheDocument();
        });
      });
  
      test('handles logout and clears user data', async () => {
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('plannedClasses', JSON.stringify(mockClasses));
  
        render(<App />);
  
        await waitFor(() => {
          expect(screen.getByTestId('search-page')).toBeInTheDocument();
        });
  
        const logoutButton = screen.getByTitle('Logout');
        fireEvent.click(logoutButton);
  
        await waitFor(() => {
          expect(api.logoutUser).toHaveBeenCalled();
          expect(screen.getByTestId('login-page')).toBeInTheDocument();
        });
      });
    });
  
    describe('Data Loading', () => {
      test('loads classes on mount', async () => {
        localStorage.setItem('token', 'mock-token');
        render(<App />);
  
        await waitFor(() => {
          expect(api.fetchClassesWithRatings).toHaveBeenCalled();
        });
      });
  
      test('shows loading state while fetching data', () => {
        localStorage.setItem('token', 'mock-token');
        api.fetchClassesWithRatings.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(mockClasses), 100))
        );
  
        render(<App />);
  
        expect(screen.getByText('Loading classes...')).toBeInTheDocument();
      });
    });
  
    describe('Navigation', () => {
      beforeEach(async () => {
        localStorage.setItem('token', 'mock-token');
        render(<App />);
        await waitFor(() => {
          expect(screen.getByTestId('search-page')).toBeInTheDocument();
        });
      });
  
      test('navigates to planner page', () => {
        const plannerButton = screen.getByTitle('My Planner');
        fireEvent.click(plannerButton);
  
        expect(screen.getByTestId('planner-calendar')).toBeInTheDocument();
      });
  
      test('navigates to degree audit page', () => {
        const auditButton = screen.getByTitle('Degree Audit');
        fireEvent.click(auditButton);
  
        expect(screen.getByTestId('degree-audit')).toBeInTheDocument();
      });
    });
  
    describe('Class Management', () => {
      beforeEach(async () => {
        localStorage.setItem('token', 'mock-token');
        render(<App />);
        await waitFor(() => {
          expect(screen.getByTestId('search-page')).toBeInTheDocument();
        });
      });
  
      test('adds class to planner', () => {
        const addButton = screen.getByText('Add First Class');
        fireEvent.click(addButton);
  
        // Navigate to planner to verify
        const plannerButton = screen.getByTitle('My Planner');
        fireEvent.click(plannerButton);
  
        expect(screen.getByText('Planned Classes: 1')).toBeInTheDocument();
      });
  
      test('prevents adding duplicate classes', () => {
        const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
        
        const addButton = screen.getByText('Add First Class');
        fireEvent.click(addButton);
        fireEvent.click(addButton);
  
        expect(alertSpy).toHaveBeenCalledWith('This class is already in your planner!');
        
        alertSpy.mockRestore();
      });
    });
  });
});