import React, { useState } from 'react'
import MultiStepRegistration from './MultiStepRegistration'
import { loginUser } from './api'
import './LoginPage.css'

/**
 * LoginPage - Handles user authentication and signup flow
 * Manages login/signup toggle, form validation, and triggers multi-step registration
 */
function LoginPage({ onLogin, onSignup }) {
  // UI state management
  const [isSignup, setIsSignup] = useState(false) // Toggle between login/signup modes
  const [showRegistration, setShowRegistration] = useState(false) // Controls multi-step registration visibility
  
  // Form data state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })
  
  // Error and loading states
  const [error, setError] = useState('') // General error messages
  const [isLoading, setIsLoading] = useState(false) // Loading state for API calls
  const [passwordError, setPasswordError] = useState('') // Real-time password validation

  /**
   * Handles form input changes with real-time validation
   * Clears errors when user starts typing and validates password strength
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
    
    // Real-time password validation for signup
    if (isSignup && name === 'password') {
      if (value.length > 0 && value.length < 6) {
        setPasswordError('Password must be at least 6 characters long')
      } else {
        setPasswordError('')
      }
    }
  }

  /**
   * Handles form submission for both login and signup
   * For signup: validates form and triggers multi-step registration
   * For login: authenticates user via API
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      setIsLoading(false)
      return
    }

    if (isSignup) {
      // Signup validation
      if (!formData.name) {
        setError('Please enter your name')
        setIsLoading(false)
        return
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long')
        setIsLoading(false)
        return
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        setIsLoading(false)
        return
      }
      // Start multi-step registration
      setShowRegistration(true)
      setIsLoading(false)
      return
    }

    // Login flow
    try {
      const result = await loginUser(formData.email, formData.password)
      onLogin(result.user)
    } catch (error) {
      setError(error.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Toggles between login and signup modes
   * Resets form data and clears all error states
   */
  const handleToggleMode = () => {
    setIsSignup(!isSignup)
    setFormData({ email: '', password: '', confirmPassword: '', name: '' })
    setError('')
    setPasswordError('')
    setShowRegistration(false)
  }

  /**
   * Callback when multi-step registration completes successfully
   * Passes user data to parent component
   */
  const handleRegistrationComplete = (user) => {
    onSignup(user)
  }

  /**
   * Returns user from registration back to login form
   * Resets all form state
   */
  const handleBackToLogin = () => {
    setShowRegistration(false)
    setFormData({ email: '', password: '', confirmPassword: '', name: '' })
    setError('')
    setPasswordError('')
  }


  // Conditional rendering: Show multi-step registration if user clicked signup
  if (showRegistration) {
    return (
      <MultiStepRegistration
        onRegistrationComplete={handleRegistrationComplete}
        onBackToLogin={handleBackToLogin}
        initialData={{
          email: formData.email,
          password: formData.password,
          name: formData.name
        }}
      />
    )
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
        <img 
          src="/cropped_logo.png?v=3" 
          alt="Vanderbilt Course Planner" 
          className="login-logo"
        />
          <p>Choose your CS courses efficiently with our recommendations</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isSignup && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              required
              className={passwordError ? 'error' : ''}
            />
            {passwordError && <span className="field-error">{passwordError}</span>}
          </div>

          {isSignup && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                required
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? 'Loading...' : (isSignup ? 'Continue to Registration' : 'Sign In')}
          </button>
        </form>

        <div className="toggle-mode">
          <p>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            <button type="button" onClick={handleToggleMode} className="toggle-button">
              {isSignup ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
