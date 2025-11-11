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
});
