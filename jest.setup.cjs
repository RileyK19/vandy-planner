// jest.setup.cjs
require('@testing-library/jest-dom');

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock fetch if you're making API calls in your components
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// // jest.setup.js
// require('@testing-library/jest-dom');

// // Mock console methods to reduce noise in test output
// global.console = {
//   ...console,
//   // Uncomment to ignore a specific log level
//   // log: jest.fn(),
//   // debug: jest.fn(),
//   // info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// // Mock window.matchMedia
// Object.defineProperty(window, 'matchMedia', {
//   writable: true,
//   value: jest.fn().mockImplementation(query => ({
//     matches: false,
//     media: query,
//     onchange: null,
//     addListener: jest.fn(), // deprecated
//     removeListener: jest.fn(), // deprecated
//     addEventListener: jest.fn(),
//     removeEventListener: jest.fn(),
//     dispatchEvent: jest.fn(),
//   })),
// });

// // Mock ResizeObserver
// global.ResizeObserver = jest.fn().mockImplementation(() => ({
//   observe: jest.fn(),
//   unobserve: jest.fn(),
//   disconnect: jest.fn(),
// }));
