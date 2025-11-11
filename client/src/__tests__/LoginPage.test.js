import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../api', () => require('../__mocks__/api.jsx'));

jest.mock('../MultiStepRegistration', () => {
  return function MockRegistration({ onRegistrationComplete, onBackToLogin, initialData }) {
    return (
      <div data-testid="multi-step-registration">
        <p>Mock Registration</p>
        <p>{initialData?.email}</p>
        <button onClick={() => onRegistrationComplete({ email: initialData?.email })}>
          Complete Registration
        </button>
        <button onClick={onBackToLogin}>Back</button>
      </div>
    );
  };
});

import LoginPage from '../LoginPage.jsx';
import * as api from '../api.jsx';

describe('LoginPage', () => {
  const mockOnLogin = jest.fn();
  const mockOnSignup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    api.loginUser.mockResolvedValue({ user: { email: 'user@example.com', name: 'User' } });
  });

  const renderLogin = () => render(<LoginPage onLogin={mockOnLogin} onSignup={mockOnSignup} />);

  test('renders login form by default', () => {
    renderLogin();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/Don't have an account\\?/i)).toBeInTheDocument();
  });

  test('validates login fields', async () => {
    renderLogin();

    const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
    fireEvent.submit(form);

    expect(
      await screen.findByText('Please fill in all fields')
    ).toBeInTheDocument();
    expect(api.loginUser).not.toHaveBeenCalled();
  });

  test('logs in successfully and calls onLogin', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(api.loginUser).toHaveBeenCalledWith('user@example.com', 'secret123');
      expect(mockOnLogin).toHaveBeenCalledWith({ email: 'user@example.com', name: 'User' });
    });
  });

  test('toggles to signup mode with additional fields', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to registration/i })).toBeInTheDocument();
  });

  test('shows error when signup passwords mismatch', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to registration/i }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockOnSignup).not.toHaveBeenCalled();
  });

  test('enters registration flow and triggers onSignup', async () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to registration/i }));

    const registration = await screen.findByTestId('multi-step-registration');
    expect(registration).toBeInTheDocument();

    fireEvent.click(screen.getByText('Complete Registration'));

    await waitFor(() => {
      expect(mockOnSignup).toHaveBeenCalledWith({ email: 'new@example.com' });
    });
  });

  test('shows error when signup name is missing', async () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret123' } });

    const form = screen.getByRole('button', { name: /continue to registration/i }).closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Please enter your name')).toBeInTheDocument();
    });
    expect(mockOnSignup).not.toHaveBeenCalled();
  });

  test('shows error when signup password is too short', async () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'short' } });

    const form = screen.getByRole('button', { name: /continue to registration/i }).closest('form');
    fireEvent.submit(form);

    // The error message appears in both field-error and error-message, so use getAllByText
    await waitFor(() => {
      const errorMessages = screen.getAllByText('Password must be at least 6 characters long');
      expect(errorMessages.length).toBeGreaterThan(0);
      // Check that the form error message exists (in error-message div)
      const formError = screen.getByText('Password must be at least 6 characters long', { selector: '.error-message' });
      expect(formError).toBeInTheDocument();
    });
    expect(mockOnSignup).not.toHaveBeenCalled();
  });

  test('shows real-time password validation error when password is too short', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'short' } });

    expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();
  });

  test('clears password validation error when password becomes valid', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const passwordInput = screen.getByLabelText('Password');
    
    // First, trigger error with short password
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();

    // Then, fix it with valid password
    fireEvent.change(passwordInput, { target: { value: 'validpassword' } });
    expect(screen.queryByText('Password must be at least 6 characters long')).not.toBeInTheDocument();
  });

  test('handles login error and displays error message', async () => {
    const errorMessage = 'Invalid credentials';
    api.loginUser.mockRejectedValue(new Error(errorMessage));

    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test('handles login error with default message when error has no message', async () => {
    api.loginUser.mockRejectedValue(new Error());

    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test('shows loading state during login', async () => {
    // Create a promise that we can control
    let resolveLogin;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    api.loginUser.mockReturnValue(loginPromise);

    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    // Resolve the promise
    resolveLogin({ user: { email: 'user@example.com', name: 'User' } });

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalled();
    });
  });

  test('clears error when user starts typing', async () => {
    api.loginUser.mockRejectedValue(new Error('Login failed'));

    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });

    // Start typing to clear error
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user2@example.com' } });

    await waitFor(() => {
      expect(screen.queryByText('Login failed')).not.toBeInTheDocument();
    });
  });

  test('toggles back from signup to login mode', () => {
    renderLogin();

    // Switch to signup
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();

    // Fill in some data
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });

    // Toggle back to login
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Should be back in login mode
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

    // Form should be reset
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput.value).toBe('');
  });

  test('returns to login form from registration', async () => {
    renderLogin();

    // Go to signup and enter registration
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to registration/i }));

    const registration = await screen.findByTestId('multi-step-registration');
    expect(registration).toBeInTheDocument();

    // Click back button
    fireEvent.click(screen.getByText('Back'));

    // Should return to login form
    await waitFor(() => {
      expect(screen.queryByTestId('multi-step-registration')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    // Form should be reset
    const emailInput = screen.getByLabelText('Email');
    expect(emailInput.value).toBe('');
  });

  test('disables submit button during loading', async () => {
    let resolveLogin;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    api.loginUser.mockReturnValue(loginPromise);

    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    // Resolve to complete the test
    resolveLogin({ user: { email: 'user@example.com', name: 'User' } });
    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalled();
    });
  });

  test('password input has error class when password error exists', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'short' } });

    // Password input should have error class
    expect(passwordInput).toHaveClass('error');
  });

  test('password input does not have error class when password is valid', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'validpassword' } });

    // Password input should not have error class
    expect(passwordInput).not.toHaveClass('error');
  });
});
