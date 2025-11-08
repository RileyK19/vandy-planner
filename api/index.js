// api/index.js - This file should be at ROOT level (not in server/)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Import User model from server folder
import User from '../server/models/User.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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

function parseTranscriptCourses(text) {
  const courses = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const coursePattern = /^(Fall|Spring|Summer|Winter)\s+(\d{4})([A-Z]{2,4})\s+(\d{4})(.+?)(\d)([A-Z][+\-]?)$/i;
    const match = line.match(coursePattern);
    
    if (match) {
      try {
        const [, season, year, subject, courseNumber] = match;
        const course = {
          courseCode: `${subject} ${courseNumber}`,
          term: `${season} ${year}`
        };
        
        if (course.courseCode && course.courseCode.length >= 3 && course.term) {
          courses.push(course);
        }
      } catch (error) {
        console.error('Error parsing course line:', line, error);
      }
    }
  }
  
  const uniqueCourses = courses.filter((course, index, self) => 
    index === self.findIndex(c => 
      c.courseCode === course.courseCode && c.term === course.term
    )
  );
  
  return uniqueCourses;
}

// MongoDB Connection Helper for Serverless
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'Users',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedDb = mongoose.connection;
    console.log('MongoDB connected');
    return cachedDb;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Middleware to ensure database connection
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    res.status(503).json({ error: 'Database connection failed' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API is running...', status: 'ok' });
});

app.get('/api/classes', async (req, res) => {
  try {
    const db = mongoose.connection.client.db('vanderbilt_courses');
    const collection = db.collection('cs_sections');
    const classes = await collection.find({ subject: 'CS' }).toArray();
    res.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rmp-ratings', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const rmpDb = db.client.db('rmp_data');
    const rmpCollection = rmpDb.collection('course_instructor_averages');
    const ratings = await rmpCollection.find({}).toArray();
    res.json(ratings);
  } catch (error) {
    console.error('Error fetching RMP ratings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/degree-requirements', async (req, res) => {
  try {
    const { major } = req.query;
    const db = mongoose.connection.db;
    const degreeDb = db.client.db('vanderbilt_courses');
    const degreeCollection = degreeDb.collection('degree_audits');
    const degreeReq = await degreeCollection.findOne({ major: major || 'Computer Science' });
    
    if (!degreeReq) {
      return res.status(404).json({ error: 'Degree requirements not found' });
    }
    
    res.json(degreeReq);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch degree requirements' });
  }
});

app.post('/api/parse-transcript', upload.single('transcript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;
    const courses = parseTranscriptCourses(text);

    if (courses.length === 0) {
      return res.status(400).json({ 
        error: 'No courses found in the transcript.',
        extractedText: text.substring(0, 500)
      });
    }

    res.json({
      success: true,
      courses: courses,
      message: `Successfully parsed ${courses.length} courses from transcript`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to process transcript PDF.',
      details: error.message
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, major, year, dorm, previousCourses = [] } = req.body;

    if (!email || !password || !name || !major || !year || !dorm) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const filteredPreviousCourses = (previousCourses || []).map(course => ({
      courseCode: course.courseCode,
      term: course.term
    })).filter(course => course.courseCode && course.term);

    const user = new User({
      email,
      password,
      name,
      major,
      year,
      dorm,
      previousCourses: filteredPreviousCourses
    });

    await user.save();

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
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.toJSON());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Add all your other routes here (put, post, delete, etc.)
// I'm including the essential ones, add the rest from your server/index.js

export default app;