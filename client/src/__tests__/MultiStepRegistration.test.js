import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../api', () => require('../__mocks__/api.jsx'));

const mockStep1 = jest.fn();
jest.mock('../Step1Major', () => (props) => {
  mockStep1(props);
  return (
    <div data-testid="step1">
      <span data-testid="step1-data">{props.data?.major || 'no-major'}</span>
      <button data-testid="step1-update" onClick={() => props.onUpdate({ major: 'Computer Science' })}>
        Step1 Update
      </button>
      <button data-testid="step1-next" onClick={props.onNext}>
        Step1 Next
      </button>
      <button data-testid="step1-back" onClick={props.onBack}>
        Step1 Back
      </button>
    </div>
  );
});

const mockStep2 = jest.fn();
jest.mock('../Step2AcademicYear', () => (props) => {
  mockStep2(props);
  return (
    <div data-testid="step2">
      <span data-testid="step2-data">{props.data?.year || 'no-year'}</span>
      <button data-testid="step2-update" onClick={() => props.onUpdate({ year: 'Junior' })}>
        Step2 Update
      </button>
      <button data-testid="step2-next" onClick={props.onNext}>
        Step2 Next
      </button>
      <button data-testid="step2-back" onClick={props.onBack}>
        Step2 Back
      </button>
    </div>
  );
});

const mockStep3 = jest.fn();
jest.mock('../Step3DormLocation', () => (props) => {
  mockStep3(props);
  return (
    <div data-testid="step3">
      <span data-testid="step3-data">{props.data?.dorm || 'no-dorm'}</span>
      <button data-testid="step3-update" onClick={() => props.onUpdate({ dorm: 'Lupton' })}>
        Step3 Update
      </button>
      <button data-testid="step3-next" onClick={props.onNext}>
        Step3 Next
      </button>
      <button data-testid="step3-back" onClick={props.onBack}>
        Step3 Back
      </button>
    </div>
  );
});

const mockStep4 = jest.fn();
jest.mock('../Step4PreviousCourses', () => (props) => {
  mockStep4(props);
  return (
    <div data-testid="step4">
      <span data-testid="step4-data">{props.data?.previousCourses?.join(',') || 'no-courses'}</span>
      <button data-testid="step4-update" onClick={() => props.onUpdate({ previousCourses: ['CS1101'] })}>
        Step4 Update
      </button>
      <button data-testid="step4-submit" onClick={props.onSubmit}>
        Step4 Submit
      </button>
      <button data-testid="step4-back" onClick={props.onBack}>
        Step4 Back
      </button>
    </div>
  );
});

import MultiStepRegistration from '../MultiStepRegistration.jsx';
import * as api from '../api.jsx';

describe('MultiStepRegistration', () => {
  const onRegistrationComplete = jest.fn();
  const onBackToLogin = jest.fn();

  const renderComponent = (initialData) =>
    render(
      <MultiStepRegistration
        onRegistrationComplete={onRegistrationComplete}
        onBackToLogin={onBackToLogin}
        initialData={initialData}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    api.registerUser.mockResolvedValue({ user: { id: '123', email: 'user@example.com' } });
  });

  test('renders first step with initial data and active indicator', () => {
    const { container } = renderComponent({ email: 'user@example.com', password: 'pass', name: 'User' });

    expect(screen.getByTestId('step1')).toBeInTheDocument();
    const firstStepProps = mockStep1.mock.calls.at(-1)[0];
    expect(firstStepProps.data.email).toBe('user@example.com');
    expect(firstStepProps.errors).toEqual({});

    const steps = container.querySelectorAll('.step');
    expect(steps).toHaveLength(4);
    expect(steps[0].className).toContain('active');
    expect(steps[1].className).not.toContain('active');
  });

  test('advances through steps, aggregates data, and submits successfully', async () => {
    renderComponent({ email: 'user@example.com', password: 'pass', name: 'User' });

    fireEvent.click(screen.getByTestId('step1-update'));
    fireEvent.click(screen.getByTestId('step1-next'));

    await screen.findByTestId('step2');
    expect(mockStep2.mock.calls.at(-1)[0].data.major).toBe('Computer Science');

    fireEvent.click(screen.getByTestId('step2-update'));
    fireEvent.click(screen.getByTestId('step2-next'));

    await screen.findByTestId('step3');
    expect(mockStep3.mock.calls.at(-1)[0].data.year).toBe('Junior');

    fireEvent.click(screen.getByTestId('step3-update'));
    fireEvent.click(screen.getByTestId('step3-next'));

    await screen.findByTestId('step4');
    expect(mockStep4.mock.calls.at(-1)[0].data.dorm).toBe('Lupton');

    fireEvent.click(screen.getByTestId('step4-update'));
    fireEvent.click(screen.getByTestId('step4-submit'));

    await waitFor(() => {
      expect(api.registerUser).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'pass',
        name: 'User',
        major: 'Computer Science',
        year: 'Junior',
        dorm: 'Lupton',
        previousCourses: ['CS1101'],
      });
      expect(onRegistrationComplete).toHaveBeenCalledWith({ id: '123', email: 'user@example.com' });
    });
  });

  test('shows submitting state and resets after success', async () => {
    const pending = new Promise((resolve) => setTimeout(() => resolve({ user: { id: 'abc' } }), 0));
    api.registerUser.mockReturnValueOnce(pending);

    renderComponent();

    fireEvent.click(screen.getByTestId('step1-next'));
    await screen.findByTestId('step2');
    fireEvent.click(screen.getByTestId('step2-next'));
    await screen.findByTestId('step3');
    fireEvent.click(screen.getByTestId('step3-next'));
    await screen.findByTestId('step4');

    fireEvent.click(screen.getByTestId('step4-submit'));

    await waitFor(() => {
      const calledWithSubmitting = mockStep4.mock.calls.some((call) => call[0].isSubmitting === true);
      expect(calledWithSubmitting).toBe(true);
    });

    await waitFor(() => {
      const lastCallProps = mockStep4.mock.calls.at(-1)[0];
      expect(lastCallProps.isSubmitting).toBe(false);
    });
  });

  test('handles registration error and clears after update', async () => {
    api.registerUser.mockRejectedValueOnce(new Error('Registration failed'));

    renderComponent();

    fireEvent.click(screen.getByTestId('step1-next'));
    await screen.findByTestId('step2');
    fireEvent.click(screen.getByTestId('step2-next'));
    await screen.findByTestId('step3');
    fireEvent.click(screen.getByTestId('step3-next'));
    await screen.findByTestId('step4');

    fireEvent.click(screen.getByTestId('step4-submit'));

    expect(await screen.findByText('Registration failed')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('step4-update'));

    await waitFor(() => {
      expect(screen.queryByText('Registration failed')).not.toBeInTheDocument();
    });
  });

  test('allows navigating backward and back to login', async () => {
    renderComponent();

    fireEvent.click(screen.getByTestId('step1-next'));
    await screen.findByTestId('step2');

    fireEvent.click(screen.getByTestId('step2-back'));
    await screen.findByTestId('step1');

    expect(mockStep1.mock.calls.at(-1)[0].data.major).toBe('');

    fireEvent.click(screen.getByTestId('step1-back'));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
