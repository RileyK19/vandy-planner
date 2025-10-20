// api.js - Mock API functions for testing
export const loginUser = async (email, password) => {
  // Simulate API call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'test@example.com' && password === 'password123') {
        resolve({
          user: {
            id: 1,
            email: email,
            name: 'Test User'
          }
        });
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 100);
  });
};

export const registerUser = async (userData) => {
  // Simulate API call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (userData.email && userData.password && userData.name) {
        resolve({
          user: {
            id: Math.floor(Math.random() * 1000),
            ...userData
          }
        });
      } else {
        reject(new Error('Registration failed'));
      }
    }, 100);
  });
};
