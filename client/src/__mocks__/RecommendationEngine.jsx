export const generateRecommendations = jest.fn(() => Promise.resolve([]));
export const enhanceWithGPT = jest.fn(() => Promise.resolve([]));

export default {
  generateRecommendations,
  enhanceWithGPT
};