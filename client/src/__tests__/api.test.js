// client/src/__tests__/api.test.js

// CRITICAL: Unmock api for this test file
jest.unmock('../api');

// Mock localStorage FIRST, before any imports
// Replace your localStorageMock with this:
const storage = {};
const localStorageMock = {
  getItem: jest.fn((key) => storage[key] || null),
  setItem: jest.fn((key, value) => { storage[key] = value; }),
  removeItem: jest.fn((key) => { delete storage[key]; }),
  clear: jest.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the recommendation engines BEFORE importing api.jsx
jest.mock('../RecommendationEngine', () => ({
  generateRecommendations: jest.fn(() => Promise.resolve([])),
  enhanceWithGPT: jest.fn(() => Promise.resolve([]))
}));

jest.mock('../RecommendationEngineFourYear', () => ({
  generateFourYearPlan: jest.fn(() => Promise.resolve({ semesters: [] }))
}));

// NOW it's safe to import api
import * as api from '../api';

describe('API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('Authentication Functions', () => {
    test('isAuthenticated returns true when token exists', () => {
      localStorageMock.getItem.mockReturnValue('fake-token');
      expect(api.isAuthenticated()).toBe(true);
    });

    test('isAuthenticated returns false when no token', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(api.isAuthenticated()).toBe(false);
    });

    test('getCurrentToken returns token when exists', () => {
      localStorageMock.getItem.mockReturnValue('fake-token');
      expect(api.getCurrentToken()).toBe('fake-token');
    });

    test('getCurrentToken returns null when no token', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(api.getCurrentToken()).toBeNull();
    });

    test('logoutUser removes token', () => {
      api.logoutUser();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });

    test('registerUser stores token on success', async () => {
      const userData = { email: 'test@vanderbilt.edu', password: 'pass123' };
      const mockResponse = { token: 'fake-token', user: userData };

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse)
      });

      await api.registerUser(userData);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'fake-token');
    });

    test('registerUser handles errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Email exists' })
      });

      await expect(api.registerUser({})).rejects.toThrow();
    });

    test('loginUser stores token on success', async () => {
      const mockResponse = { token: 'fake-token', user: { email: 'test@vanderbilt.edu' } };

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse)
      });

      await api.loginUser('test@vanderbilt.edu', 'password123');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'fake-token');
    });

    test('loginUser handles errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Invalid credentials' })
      });

      await expect(api.loginUser('test@vanderbilt.edu', 'wrong')).rejects.toThrow();
    });

    test('getUserProfile fetches profile successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');
      const mockProfile = { email: 'test@vanderbilt.edu', major: 'CS' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile
      });

      const result = await api.getUserProfile();
      expect(result).toEqual(mockProfile);
    });

    test('getUserProfile handles 401 error', async () => {
      localStorageMock.getItem.mockReturnValue('expired-token');

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      });

      await expect(api.getUserProfile()).rejects.toThrow('Session expired');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });

    test('updateUserProfile updates successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');
      const mockResponse = { email: 'test@vanderbilt.edu', major: 'Math' };

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await api.updateUserProfile({ major: 'Math' });
      expect(result).toEqual(mockResponse);
    });

    test('updateUserProfile handles errors', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Invalid data' })
      });

      await expect(api.updateUserProfile({})).rejects.toThrow();
    });
  });

  describe('Data Fetching', () => {
    test('fetchClassesFromDB returns data successfully', async () => {
      const mockData = [{
        _id: '1',
        abbreviation: 'CS 1101',
        courseName: 'Programming',
        hours: 3,
        schedule: 'MWF;10:00a-11:00a'
      }];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await api.fetchClassesFromDB();
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
    });

    test('fetchClassesFromDB handles errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error'
      });

      const result = await api.fetchClassesFromDB();
      expect(result).toBeNull();
    });

    test('fetchRMPData returns ratings map', async () => {
      const mockData = [{
        courseId: 'CS 1101',
        instructorName: 'Smith, John',
        averageQuality: 4.5,
        averageDifficulty: 3.2
      }];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await api.fetchRMPData();
      expect(typeof result).toBe('object');
    });

    test('fetchRMPData handles errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await api.fetchRMPData();
      expect(result).toEqual({});
    });

    test('fetchClassesWithRatings combines data', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{
            _id: '1',
            abbreviation: 'CS 1101',
            courseName: 'Programming',
            hours: 3
          }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      const result = await api.fetchClassesWithRatings();
      expect(result).toBeTruthy();
    });

    test('fetchClassesWithRatings handles null classes', async () => {
      fetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await api.fetchClassesWithRatings();
      expect(result).toBeNull();
    });
  });

  describe('Rating Functions', () => {
    test('formatRating formats quality correctly', () => {
      const result = api.formatRating(4.5, 'quality');
      expect(result).toHaveProperty('value', '4.5');
      expect(result).toHaveProperty('color');
    });

    test('formatRating handles null', () => {
      const result = api.formatRating(null);
      expect(result).toBe('N/A');
    });

    test('formatRating handles undefined', () => {
      const result = api.formatRating(undefined);
      expect(result).toBe('N/A');
    });

    test('getClassAverageRatings calculates averages', () => {
      const cls = {
        rmpData: {
          'Prof A': { quality: 4.5, difficulty: 3.0 },
          'Prof B': { quality: 4.0, difficulty: 3.5 }
        }
      };

      const result = api.getClassAverageRatings(cls);
      expect(result.avgQuality).toBeCloseTo(4.25);
      expect(result.avgDifficulty).toBeCloseTo(3.25);
    });

    test('getClassAverageRatings handles empty data', () => {
      const result = api.getClassAverageRatings({ rmpData: {} });
      expect(result).toBeNull();
    });

    test('getClassAverageRatings handles missing rmpData', () => {
      const result = api.getClassAverageRatings({});
      expect(result).toBeNull();
    });
  });

  describe('Schedule Functions', () => {
    test('saveUserSchedule saves successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await api.saveUserSchedule('Fall 2025', []);
      expect(result).toEqual({ success: true });
    });

    test('saveUserSchedule handles errors', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Save failed' })
      });

      await expect(api.saveUserSchedule('Fall 2025', [])).rejects.toThrow();
    });

    test('getUserSchedules fetches successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'Fall 2025' }]
      });

      const result = await api.getUserSchedules();
      expect(Array.isArray(result)).toBe(true);
    });

    test('savePlannedClassesToDB saves successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await api.savePlannedClassesToDB([]);
      expect(result).toBeTruthy();
    });

    test('savePlannedClassesToDB handles 401 error', async () => {
      localStorageMock.getItem.mockReturnValue('expired-token');

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(api.savePlannedClassesToDB([])).rejects.toThrow('Session expired');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('Semester Planner Functions', () => {
    test('saveSemesterPlanner saves successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await api.saveSemesterPlanner('Fall 2025', []);
      expect(result).toEqual({ success: true });
    });

    test('loadSemesterPlanner loads successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ semesterName: 'Fall 2025', classes: [] })
      });

      const result = await api.loadSemesterPlanner();
      expect(result).toBeTruthy();
    });

    test('removeFromSemesterPlanner removes successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await api.removeFromSemesterPlanner('CS1101');
      expect(result).toEqual({ success: true });
    });

    test('updateClassInPlanner updates successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await api.updateClassInPlanner('CS1101', { code: 'CS 1101' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('Degree Requirements', () => {
    test('fetchDegreeRequirements fetches successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ major: 'CS', categories: [] }]
      });

      const result = await api.fetchDegreeRequirements('Computer Science');
      expect(result).toBeTruthy();
    });

    test('fetchDegreeRequirements handles empty array', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const result = await api.fetchDegreeRequirements('Unknown');
      expect(result).toEqual([]);
    });

    test('fetchDegreeRequirements handles errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(api.fetchDegreeRequirements('CS')).rejects.toThrow();
    });
  });

  describe('Prerequisites Functions', () => {
    test('fetchCoursePrerequisites fetches successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ courseCode: 'CS 2201', prerequisites: ['CS 1101'] })
      });

      const result = await api.fetchCoursePrerequisites('CS 2201');
      expect(result).toBeTruthy();
    });

    test('fetchBatchPrerequisites fetches successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'CS 2201': { prerequisites: ['CS 1101'] } })
      });

      const result = await api.fetchBatchPrerequisites(['CS 2201']);
      expect(result).toBeTruthy();
    });

    test('fetchBatchPrerequisites handles errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await api.fetchBatchPrerequisites(['CS 2201']);
      expect(result).toEqual({});
    });
  });

  describe('User Courses', () => {
    test('fetchUserTakenCourses fetches successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ courseCode: 'CS 1101', term: 'Fall 2024' }]
      });

      const result = await api.fetchUserTakenCourses('test@vanderbilt.edu');
      expect(Array.isArray(result)).toBe(true);
    });

    test('fetchUserTakenCourses handles errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(api.fetchUserTakenCourses('test@vanderbilt.edu')).rejects.toThrow();
    });

    test('savePastCoursesToDB saves successfully', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await api.savePastCoursesToDB([{ courseCode: 'CS 1101' }]);
      expect(result).toBeTruthy();
    });

    test('savePastCoursesToDB handles errors', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Save failed' })
      });

      await expect(api.savePastCoursesToDB([])).rejects.toThrow();
    });
  });

  describe('Recommendations', () => {
    test('getCourseRecommendations handles no classes', async () => {
      localStorageMock.getItem.mockReturnValue('fake-token');

      fetch
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // taken courses
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // classes

      await expect(
        api.getCourseRecommendations({}, 'CS', 'test@vanderbilt.edu', [])
      ).rejects.toThrow('No classes available');
    });
  });
});

test('DEBUG: check what localStorage is being used', () => {
    console.log('localStorage:', localStorage);
    console.log('localStorage.getItem:', localStorage.getItem);
    
    localStorageMock.getItem.mockReturnValue('test-token');
    const result = localStorage.getItem('token');
    console.log('Direct call result:', result);
    
    const apiResult = api.isAuthenticated();
    console.log('api.isAuthenticated result:', apiResult);
    console.log('getItem called?', localStorageMock.getItem.mock.calls);
  });