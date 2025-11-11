// client/src/__tests__/api.test.js

// IMPORTANT: Mock dependencies BEFORE importing api
jest.mock('../RecommendationEngine', () => ({
    generateRecommendations: jest.fn(() => []),
    enhanceWithGPT: jest.fn((recs) => Promise.resolve(recs))
  }));
  
  jest.mock('../RecommendationEngineFourYear', () => ({
    generateFourYearPlan: jest.fn(() => ({ semesters: [] }))
  }));
  
  // Mock globals
  global.fetch = jest.fn();
  global.console = { ...console, log: jest.fn(), error: jest.fn(), warn: jest.fn() };
  
  // Import after mocks
  import * as api from '../api';
  
  describe('API Functions', () => {
    beforeEach(() => {
      fetch.mockClear();
      localStorage.clear();
    });
  
    describe('Data Fetching', () => {
      test('fetchClassesFromDB returns formatted classes', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{
            _id: '1',
            sectionId: 'CS1101-001',
            abbreviation: 'CS 1101',
            courseName: 'Programming',
            subject: 'CS',
            hours: 3,
            schedule: 'MWF;10:00a-11:00a',
            instructors: ['Smith, John']
          }])
        });
  
        const result = await api.fetchClassesFromDB();
        
        expect(result).toBeTruthy();
        expect(result[0].code).toBe('CS 1101');
        expect(result[0].name).toBe('Programming');
        expect(result[0].schedule).toBeTruthy();
      });
  
      test('fetchClassesFromDB returns null on error', async () => {
        fetch.mockResolvedValue({ ok: false });
        const result = await api.fetchClassesFromDB();
        expect(result).toBeNull();
      });
  
      test('fetchRMPData returns ratings map', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{
            courseId: 'CS 1101',
            instructorName: 'Smith, John',
            averageQuality: 4.5,
            averageDifficulty: 3.2
          }])
        });
  
        const result = await api.fetchRMPData();
        expect(typeof result).toBe('object');
      });
  
      test('fetchRMPData returns empty object on error', async () => {
        fetch.mockRejectedValue(new Error('Network error'));
        const result = await api.fetchRMPData();
        expect(result).toEqual({});
      });
  
      test('fetchClassesWithRatings combines data', async () => {
        fetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{
              _id: '1',
              abbreviation: 'CS 1101',
              courseName: 'Programming',
              hours: 3,
              instructors: ['Smith, John']
            }])
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([])
          });
  
        const result = await api.fetchClassesWithRatings();
        expect(result).toBeTruthy();
        expect(result[0]).toHaveProperty('rmpData');
      });
    });
  
    describe('Rating Functions', () => {
      test('formatRating formats numbers correctly', () => {
        const result = api.formatRating(4.5, 'quality');
        expect(result.value).toBe('4.5');
        expect(result.color).toBeTruthy();
      });
  
      test('formatRating returns N/A for null', () => {
        expect(api.formatRating(null)).toBe('N/A');
        expect(api.formatRating(undefined)).toBe('N/A');
      });
  
      test('getClassAverageRatings calculates correctly', () => {
        const result = api.getClassAverageRatings({
          rmpData: {
            'Prof A': { quality: 4.5, difficulty: 3.0 },
            'Prof B': { quality: 4.0, difficulty: 3.5 }
          }
        });
        
        expect(result.avgQuality).toBeCloseTo(4.25);
        expect(result.avgDifficulty).toBeCloseTo(3.25);
        expect(result.hasData).toBe(true);
      });
  
      test('getClassAverageRatings returns null for empty', () => {
        expect(api.getClassAverageRatings({})).toBeNull();
        expect(api.getClassAverageRatings({ rmpData: {} })).toBeNull();
      });
    });
  
    describe('Degree Requirements', () => {
      test('fetchDegreeRequirements returns data', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{ major: 'CS', categories: [] }])
        });
  
        const result = await api.fetchDegreeRequirements('Computer Science');
        expect(result).toEqual({ major: 'CS', categories: [] });
      });
  
      test('fetchDegreeRequirements handles empty array', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([])
        });
  
        const result = await api.fetchDegreeRequirements('Unknown');
        expect(result).toEqual([]);
      });
  
      test('fetchDegreeRequirements throws on error', async () => {
        fetch.mockResolvedValue({ ok: false, statusText: 'Not Found' });
        await expect(api.fetchDegreeRequirements('CS')).rejects.toThrow();
      });
    });
  
    describe('Prerequisites', () => {
      test('fetchCoursePrerequisites returns data', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ courseCode: 'CS 2201', prerequisites: ['CS 1101'] })
        });
  
        const result = await api.fetchCoursePrerequisites('CS 2201');
        expect(result.courseCode).toBe('CS 2201');
      });
  
      test('fetchBatchPrerequisites returns map', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ 'CS 2201': { prerequisites: ['CS 1101'] } })
        });
  
        const result = await api.fetchBatchPrerequisites(['CS 2201']);
        expect(result['CS 2201']).toBeTruthy();
      });
  
      test('fetchBatchPrerequisites returns empty on error', async () => {
        fetch.mockRejectedValue(new Error('Network error'));
        const result = await api.fetchBatchPrerequisites(['CS 2201']);
        expect(result).toEqual({});
      });
    });
  
    describe('User Courses', () => {
      test('fetchUserTakenCourses returns courses', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{ courseCode: 'CS 1101' }])
        });
  
        const result = await api.fetchUserTakenCourses('test@vanderbilt.edu');
        expect(Array.isArray(result)).toBe(true);
      });
  
      test('fetchUserTakenCourses throws on error', async () => {
        fetch.mockResolvedValue({ ok: false, statusText: 'Not Found' });
        await expect(api.fetchUserTakenCourses('test@vanderbilt.edu')).rejects.toThrow();
      });
    });
  
    describe('Authentication Functions - Read Only', () => {
      test('isAuthenticated checks localStorage', () => {
        localStorage.setItem('authToken', 'test-token');
        expect(api.isAuthenticated()).toBe(true);
        
        localStorage.removeItem('authToken');
        expect(api.isAuthenticated()).toBe(false);
      });
  
      test('getCurrentToken retrieves token', () => {
        localStorage.setItem('authToken', 'test-token');
        expect(api.getCurrentToken()).toBe('test-token');
        
        localStorage.removeItem('authToken');
        expect(api.getCurrentToken()).toBeNull();
      });
  
      test('logoutUser clears token', () => {
        localStorage.setItem('authToken', 'test-token');
        api.logoutUser();
        expect(localStorage.getItem('authToken')).toBeNull();
      });
    });
  
    describe('Authentication API Calls', () => {
      test('registerUser calls correct endpoint', async () => {
        fetch.mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ token: 'new-token', user: {} }))
        });
  
        await api.registerUser({ email: 'test@vanderbilt.edu', password: 'pass123' });
        
        expect(fetch).toHaveBeenCalledWith(
          '/api/auth/register',
          expect.objectContaining({ method: 'POST' })
        );
        expect(localStorage.getItem('authToken')).toBe('new-token');
      });
  
      test('registerUser handles errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          text: () => Promise.resolve(JSON.stringify({ error: 'Email exists' }))
        });
  
        await expect(api.registerUser({})).rejects.toThrow('Email exists');
      });
  
      test('loginUser calls correct endpoint', async () => {
        fetch.mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ token: 'login-token', user: {} }))
        });
  
        await api.loginUser('test@vanderbilt.edu', 'password');
        
        expect(fetch).toHaveBeenCalledWith(
          '/api/auth/login',
          expect.objectContaining({ method: 'POST' })
        );
        expect(localStorage.getItem('authToken')).toBe('login-token');
      });
  
      test('getUserProfile calls with auth header', async () => {
        localStorage.setItem('authToken', 'test-token');
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ email: 'test@vanderbilt.edu' })
        });
  
        await api.getUserProfile();
        
        expect(fetch).toHaveBeenCalledWith(
          '/api/auth/profile',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token'
            })
          })
        );
      });
  
      test('getUserProfile handles 401', async () => {
        localStorage.setItem('authToken', 'expired-token');
        fetch.mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' })
        });
  
        await expect(api.getUserProfile()).rejects.toThrow('Session expired');
        expect(localStorage.getItem('authToken')).toBeNull();
      });
  
      test('updateUserProfile calls correct endpoint', async () => {
        localStorage.setItem('authToken', 'test-token');
        fetch.mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ major: 'Math' }))
        });
  
        await api.updateUserProfile({ major: 'Math' });
        
        expect(fetch).toHaveBeenCalledWith(
          '/api/auth/profile',
          expect.objectContaining({ method: 'PUT' })
        );
      });
    });
  
    describe('Schedule Functions', () => {
      beforeEach(() => {
        localStorage.setItem('authToken', 'test-token');
      });
  
      test('saveUserSchedule saves successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
  
        const result = await api.saveUserSchedule('Fall 2025', []);
        expect(result.success).toBe(true);
      });
  
      test('getUserSchedules fetches successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{ name: 'Fall 2025' }])
        });
  
        const result = await api.getUserSchedules();
        expect(Array.isArray(result)).toBe(true);
      });
  
      test('savePlannedClassesToDB saves successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
  
        const result = await api.savePlannedClassesToDB([]);
        expect(result).toBeTruthy();
      });
  
      test('savePlannedClassesToDB handles 401', async () => {
        fetch.mockResolvedValue({ ok: false, status: 401 });
  
        await expect(api.savePlannedClassesToDB([])).rejects.toThrow('Session expired');
        expect(localStorage.getItem('authToken')).toBeNull();
      });
  
      test('savePastCoursesToDB saves successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
  
        const result = await api.savePastCoursesToDB([{ courseCode: 'CS 1101' }]);
        expect(result).toBeTruthy();
      });
    });
  
    describe('Semester Planner Functions', () => {
      beforeEach(() => {
        localStorage.setItem('authToken', 'test-token');
      });
  
      test('saveSemesterPlanner saves successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
  
        const result = await api.saveSemesterPlanner('Fall 2025', []);
        expect(result.success).toBe(true);
      });
  
      test('loadSemesterPlanner loads successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ semesterName: 'Fall 2025', classes: [] })
        });
  
        const result = await api.loadSemesterPlanner();
        expect(result.semesterName).toBe('Fall 2025');
      });
  
      test('removeFromSemesterPlanner removes successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
  
        const result = await api.removeFromSemesterPlanner('CS1101');
        expect(result.success).toBe(true);
      });
  
      test('updateClassInPlanner updates successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
  
        const result = await api.updateClassInPlanner('CS1101', { code: 'CS 1101' });
        expect(result.success).toBe(true);
      });
    });
  
    describe('Recommendations', () => {
      test('getCourseRecommendations handles missing classes', async () => {
        localStorage.setItem('authToken', 'test-token');
        
        fetch
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // taken courses
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(null) }); // classes
  
        await expect(
          api.getCourseRecommendations({}, 'CS', 'test@vanderbilt.edu', [])
        ).rejects.toThrow('No classes available');
      });
    });
  });