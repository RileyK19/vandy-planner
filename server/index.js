import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Connect to MongoDB first, then define routes and start server
mongoose.connect(process.env.MONGO_URI, {
  dbName: 'Users' // Use the Users database
})
  .then(() => {
    console.log('MongoDB connected to Users database');
    
    // Define routes AFTER MongoDB connection
    app.get('/', (req, res) => {
      res.send('API is running...');
    });

app.get('/api/test-db', async (req, res) => {
  console.log('Testing database connection...');
  try {
    const db = mongoose.connection.client.db('vanderbilt_courses');
    console.log('Connected to database:', db.databaseName);
    
    const collection = db.collection('cs_sections');
    const totalCount = await collection.countDocuments();
    console.log('Total documents in cs_sections:', totalCount);
    
    const samples = await collection.find({}).limit(3).toArray();
    
    res.json({
      database: db.databaseName,
      totalCount,
      samples
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/classes', async (req, res) => {
  console.log('API route hit - fetching classes...');
  try {
    const db = mongoose.connection.client.db('vanderbilt_courses');
    const collection = db.collection('cs_sections');
    const classes = await collection.find({ subject: 'CS' }).toArray();
    console.log('Found classes:', classes.length);
    res.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rmp-ratings', async (req, res) => {
  console.log('Fetching RMP ratings...');
  try {
    const db = mongoose.connection.db;
    
    // Try to connect to rmp_data database
    const rmpDb = db.client.db('rmp_data');
    const rmpCollection = rmpDb.collection('course_instructor_averages');
    
    const ratings = await rmpCollection.find({}).toArray();
    console.log('Found RMP ratings:', ratings.length);
    
    res.json(ratings);
  } catch (error) {
    console.error('Error fetching RMP ratings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/degree-requirements', async (req, res) => {
  try {
    const { major } = req.query;
    
    // Query MongoDB for degree requirements
    const db = mongoose.connection.db;
    const degreeDb = db.client.db('vanderbilt_courses');
    const degreeCollection = degreeDb.collection('degree_audits');
    
    const degreeReq = await degreeCollection.findOne({ major: major || 'Computer Science' }); // Changed to findOne
    
    if (!degreeReq) {
      return res.status(404).json({ error: 'Degree requirements not found' });
    }
    
    res.json(degreeReq); // Now returns object instead of array
  } catch (error) {
    console.error('Error fetching degree requirements:', error);
    res.status(500).json({ error: 'Failed to fetch degree requirements' });
  }
});

app.get('/api/users/:email/courses', async (req, res) => {
  console.log('HIT: /api/users/:email/courses'); // Add this
  try {
    const { email } = req.params;

    const db = mongoose.connection.db;
    const userDb = db.client.db('vanderbilt_courses');
    const usersCollection = userDb.collection('Users');

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.previousCourses || []);
  } catch (error) {
    console.error('Error fetching user courses:', error);
    res.status(500).json({ error: 'Failed to fetch user courses' });
  }
});

// Authentication Routes

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, year, dorm, previousCourses = [] } = req.body;

    // Validate required fields
    if (!email || !password || !name || !year || !dorm) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, password, name, year, and dorm are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create new user
    const user = new User({
      email,
      password,
      name,
      year,
      dorm,
      previousCourses
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/profile (protected)
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.toJSON());
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/auth/save-schedule (protected)
app.post('/api/auth/save-schedule', authenticateToken, async (req, res) => {
  try {
    const { scheduleName, classes } = req.body;

    if (!scheduleName || !Array.isArray(classes)) {
      return res.status(400).json({ error: 'Schedule name and classes array are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add new schedule to user's plannedSchedules
    user.plannedSchedules.push({
      scheduleName,
      classes,
      createdAt: new Date()
    });

    await user.save();

    res.json({ message: 'Schedule saved successfully', schedule: user.plannedSchedules[user.plannedSchedules.length - 1] });
  } catch (error) {
    console.error('Save schedule error:', error);
    res.status(500).json({ error: 'Failed to save schedule' });
  }
});

// GET /api/auth/schedules (protected)
app.get('/api/auth/schedules', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.plannedSchedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Test endpoint to verify Users collection
app.get('/api/test-users', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.json({ 
      message: 'Users collection is working',
      userCount,
      database: 'Users'
    });
  } catch (error) {
    console.error('Test users error:', error);
    res.status(500).json({ error: 'Failed to test Users collection' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));