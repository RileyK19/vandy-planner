import React, { useState } from 'react'
import MultiStepRegistration from './MultiStepRegistration'
import { loginUser } from './api'
import './LoginPage.css'

function LoginPage({ onLogin, onSignup }) {
  const [isSignup, setIsSignup] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')

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

    try {
      const result = await loginUser(formData.email, formData.password)
      onLogin(result.user)
    } catch (error) {
      setError(error.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleMode = () => {
    setIsSignup(!isSignup)
    setFormData({ email: '', password: '', confirmPassword: '', name: '' })
    setError('')
    setPasswordError('')
    setShowRegistration(false)
  }

  const handleRegistrationComplete = (user) => {
    onSignup(user)
  }

  const handleBackToLogin = () => {
    setShowRegistration(false)
    setFormData({ email: '', password: '', confirmPassword: '', name: '' })
    setError('')
    setPasswordError('')
  }


  // Show multi-step registration if user clicked signup
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
