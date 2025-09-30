import React, { useState } from 'react'
import './LoginPage.css'

function LoginPage({ onLogin, onSignup }) {
  const [isSignup, setIsSignup] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      return
    }

    if (isSignup && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (isSignup) {
      onSignup(formData.email, formData.password)
    } else {
      onLogin(formData.email, formData.password)
    }
  }

  const handleToggleMode = () => {
    setIsSignup(!isSignup)
    setFormData({ email: '', password: '', confirmPassword: '' })
    setError('')
  }


  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Vanderbilt Course Planner</h1>
          <p>Plan your CS courses efficiently with smart recommendations</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
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
            />
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

          <button type="submit" className="submit-button">
            {isSignup ? 'Create Account' : 'Sign In'}
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
