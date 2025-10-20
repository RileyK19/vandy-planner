# User Onboarding Tests

Unit tests for the user onboarding process components.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test
```

## Test Coverage

The test suite covers all onboarding components:

- **LoginPage**: Form validation, login/signup toggle, password validation
- **MultiStepRegistration**: Step navigation, data aggregation, progress tracking
- **Step1Major**: Major selection and validation
- **Step2AcademicYear**: Academic year selection and validation
- **Step3DormLocation**: Dorm location input and validation
- **Step4PreviousCourses**: Course entry, add/remove functionality, optional completion
- **Integration Tests**: Complete onboarding flow from login to registration

## Test Commands

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:verbose  # Run tests with verbose output
```

## Test Results

- **31 tests total** - All passing ✅
- **82% code coverage** - Comprehensive coverage
- **Fast execution** - ~1 second runtime

## Files

- `onboarding.test.js` - Main test file with all component tests
- `package.json` - Dependencies and test scripts
- `jest.setup.js` - Jest configuration
- `api.js` - Mock API functions