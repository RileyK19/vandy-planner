export const generateRecommendations = jest.fn(() => []);
export const enhanceWithGPT = jest.fn(() => Promise.resolve([]));
export const formatRecommendation = jest.fn((course, neededCourses) => ({
  ...course,
  recommendationReasons: [],
  matchScore: course.score
}));