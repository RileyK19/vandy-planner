import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createRequire } from 'module';
import User from './models/User.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

// Function to parse course information from transcript text
function parseTranscriptCourses(text) {
  const courses = [];
  
  // Split text into lines for better parsing
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Pattern for Vanderbilt transcript format where term, code, title, credits, and grade run together
    // Example: Fall 2024CS 2201Program Design and Data Structures3A
    // Pattern: (Term Year)(Subject Code)(Course Number)(Course Title)(Credits)(Grade)
    const coursePattern = /^(Fall|Spring|Summer|Winter)\s+(\d{4})([A-Z]{2,4})\s+(\d{4})(.+?)(\d)([A-Z][+\-]?)$/i;
    const match = line.match(coursePattern);
    
    if (match) {
      try {
        const [, season, year, subject, courseNumber, courseName, credits, grade] = match;
        const course = {
          courseCode: `${subject} ${courseNumber}`,
          courseName: courseName.trim(),
          grade: grade,
          term: `${season} ${year}`,
          completedAt: new Date() // Default to current date
        };
        
        // Validate course data
        if (course.courseCode && course.courseCode.length >= 3 && 
            course.grade && course.term) {
          courses.push(course);
          console.log('Successfully parsed course:', course.courseCode, course.courseName);
        }
      } catch (error) {
        console.error('Error parsing course line:', line, error);
      }
    }
  }
  
  // Remove duplicates based on course code and term
  const uniqueCourses = courses.filter((course, index, self) => 
    index === self.findIndex(c => 
      c.courseCode === course.courseCode && c.term === course.term
    )
  );
  
  return uniqueCourses;
}

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

    // POST /api/parse-transcript - Parse PDF transcript to extract courses
    app.post('/api/parse-transcript', upload.single('transcript'), async (req, res) => {
      try {
        console.log('=== PDF Upload Request Received ===');
        
        if (!req.file) {
          console.log('ERROR: No file in request');
          return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        console.log('File details:', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        });

        // Parse PDF text
        console.log('Starting PDF parsing...');
        console.log('Buffer type:', typeof req.file.buffer, 'Buffer length:', req.file.buffer.length);
        
        const pdfData = await pdfParse(req.file.buffer);
        console.log('PDF data object:', Object.keys(pdfData));
        
        const text = pdfData.text;

        console.log('PDF text extracted successfully, length:', text.length);
        console.log('Full extracted text:\n', text);

        // Parse courses from the text
        const courses = parseTranscriptCourses(text);

        console.log('Parsed courses:', courses.length);
        console.log('Course details:', JSON.stringify(courses, null, 2));

        if (courses.length === 0) {
          return res.status(400).json({ 
            error: 'No courses found in the transcript. The transcript format may not be supported. Please add courses manually or contact support.',
            extractedText: text.substring(0, 500) // Send a preview to help debug
          });
        }

        res.json({
          success: true,
          courses: courses,
          message: `Successfully parsed ${courses.length} courses from transcript`
        });

      } catch (error) {
        console.error('PDF parsing error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
          error: 'Failed to process transcript PDF. Please try again or contact support.',
          details: error.message
        });
      }
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

// Removed duplicate endpoint - using the one below

// Authentication Routes

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, major, year, dorm, previousCourses = [] } = req.body;

    // Validate required fields
    if (!email || !password || !name || !major || !year || !dorm) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, password, name, major, year, and dorm are required' 
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
      major,
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

    // Explicitly map all course fields to ensure they're saved
    const mappedClasses = classes.map(cls => ({
      courseId: cls.courseId || cls.id,
      code: cls.code,
      name: cls.name,
      hours: cls.hours || 3,
      semester: cls.semester,
      subject: cls.subject,
      professors: cls.professors || [],
      term: cls.term,
      sectionNumber: cls.sectionNumber,
      active: cls.active,
      schedule: cls.schedule
    }));

    // Add new schedule to user's plannedSchedules
    user.plannedSchedules.push({
      scheduleName,
      classes: mappedClasses,
      createdAt: new Date()
    });

    await user.save();

    res.json({ 
      message: 'Schedule saved successfully', 
      schedule: user.plannedSchedules[user.plannedSchedules.length - 1] 
    });
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

  // POST /api/auth/past-courses (protected)
app.post('/api/auth/past-courses', authenticateToken, async (req, res) => {
  try {
    const { courses } = req.body;

    if (!Array.isArray(courses)) {
      return res.status(400).json({ error: 'Courses array is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add courses to user's completedCourses
    user.completedCourses = user.completedCourses || [];
    courses.forEach(course => {
      // Avoid duplicates
      const exists = user.completedCourses.some(c => 
        c.id === course.id && c.semester === course.semester
      );
      if (!exists) {
        user.completedCourses.push(course);
      }
    });

    await user.save();

    res.json({ 
      message: 'Past courses saved successfully', 
      totalCompleted: user.completedCourses.length 
    });
  } catch (error) {
    console.error('Save past courses error:', error);
    res.status(500).json({ error: 'Failed to save past courses' });
  }
});

app.get('/api/users/:email/courses', async (req, res) => {
  try {
    const { email } = req.params;
    console.log('Fetching courses for user:', email);
    
    // Use the User model to fetch from the correct database
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('Found user, previousCourses:', user.previousCourses);
    // Return the user's previous courses (from registration or PDF upload)
    res.json(user.previousCourses || []);
  } catch (error) {
    console.error('Error fetching user courses:', error);
    res.status(500).json({ error: 'Failed to fetch user courses' });
  }
});

// Get prerequisites for a specific course
app.get('/api/courses/:courseCode/prerequisites', async (req, res) => {
  try {
    const { courseCode } = req.params;
    const db = mongoose.connection.client.db('Users');
    const prerequisitesCollection = db.collection('prerequisites');
    
    const prereqData = await prerequisitesCollection.findOne({ 
      courseId: courseCode.toUpperCase() 
    });
    
    if (!prereqData) {
      return res.json({ 
        courseId: courseCode,
        hasPrerequisites: false,
        prerequisites: []
      });
    }
    
    res.json({
      courseId: prereqData.courseId,
      hasPrerequisites: true,
      prerequisiteText: prereqData.prerequisiteText,
      prerequisiteType: prereqData.prerequisiteType,
      prerequisiteCourses: prereqData.prerequisiteCourses || [],
      lastUpdated: prereqData.lastUpdated
    });
  } catch (error) {
    console.error('Error fetching prerequisites:', error);
    res.status(500).json({ error: 'Failed to fetch prerequisites' });
  }
});

// Get prerequisites for multiple courses (batch request)
app.post('/api/courses/prerequisites/batch', async (req, res) => {
  try {
    const { courseCodes } = req.body;
    
    if (!Array.isArray(courseCodes) || courseCodes.length === 0) {
      return res.status(400).json({ error: 'courseCodes must be a non-empty array' });
    }
    
    const db = mongoose.connection.client.db('Users');
    const prerequisitesCollection = db.collection('prerequisites');
    
    const upperCaseCodes = courseCodes.map(code => code.toUpperCase());
    
    const prerequisites = await prerequisitesCollection
      .find({ courseId: { $in: upperCaseCodes } })
      .toArray();
    
    // Create a map for easy lookup
    const prereqMap = {};
    prerequisites.forEach(prereq => {
      prereqMap[prereq.courseId] = {
        hasPrerequisites: true,
        prerequisiteText: prereq.prerequisiteText,
        prerequisiteType: prereq.prerequisiteType,
        prerequisiteCourses: prereq.prerequisiteCourses || [],
        lastUpdated: prereq.lastUpdated
      };
    });
    
    // Fill in courses without prerequisites
    courseCodes.forEach(code => {
      const upperCode = code.toUpperCase();
      if (!prereqMap[upperCode]) {
        prereqMap[upperCode] = {
          hasPrerequisites: false,
          prerequisites: []
        };
      }
    });
    
    res.json(prereqMap);
  } catch (error) {
    console.error('Error fetching batch prerequisites:', error);
    res.status(500).json({ error: 'Failed to fetch prerequisites' });
  }
});

// Get degree requirements by major (add after your other endpoints)
app.get('/api/degree-requirements/:major', async (req, res) => {
  try {
    const { major } = req.params;
    const db = mongoose.connection.client.db('Users');
    const degreeRequirementsCollection = db.collection('degree_requirements');
    
    let degreeData = await degreeRequirementsCollection.findOne({ 
      major: { $regex: new RegExp(`^${major}$`, 'i') }
    });
    
    if (!degreeData) {
      return res.status(404).json({ 
        error: 'Degree requirements not found',
        major: major
      });
    }
    
    res.json(degreeData);
  } catch (error) {
    console.error('Error fetching degree requirements:', error);
    res.status(500).json({ error: 'Failed to fetch degree requirements' });
  }
});