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

// Function to parse course information from transcript text
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
          console.log('Successfully parsed course:', course.courseCode, course.term);
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
    console.log('Using cached database connection');
    return cachedDb;
  }

  console.log('Creating new database connection');
  
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'Users',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedDb = mongoose.connection;
    console.log('MongoDB connected to Users database');
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
    console.error('Database connection failed:', error);
    res.status(503).json({ error: 'Database connection failed' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API is running...', status: 'ok' });
});

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

    console.log('Starting PDF parsing...');
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    console.log('PDF text extracted successfully, length:', text.length);

    const courses = parseTranscriptCourses(text);
    console.log('Parsed courses:', courses.length);

    if (courses.length === 0) {
      return res.status(400).json({ 
        error: 'No courses found in the transcript. The transcript format may not be supported.',
        extractedText: text.substring(0, 500)
      });
    }

    res.json({
      success: true,
      courses: courses,
      message: `Successfully parsed ${courses.length} courses from transcript`
    });

  } catch (error) {
    console.error('PDF parsing error:', error);
    res.status(500).json({ 
      error: 'Failed to process transcript PDF.',
      details: error.message
    });
  }
});

app.get('/api/test-db', async (req, res) => {
  try {
    const db = mongoose.connection.client.db('vanderbilt_courses');
    const collection = db.collection('cs_sections');
    const totalCount = await collection.countDocuments();
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
  try {
    const db = mongoose.connection.db;
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
    const db = mongoose.connection.db;
    const degreeDb = db.client.db('vanderbilt_courses');
    const degreeCollection = degreeDb.collection('degree_audits');
    
    const degreeReq = await degreeCollection.findOne({ major: major || 'Computer Science' });
    
    if (!degreeReq) {
      return res.status(404).json({ error: 'Degree requirements not found' });
    }
    
    res.json(degreeReq);
  } catch (error) {
    console.error('Error fetching degree requirements:', error);
    res.status(500).json({ error: 'Failed to fetch degree requirements' });
  }
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, major, year, dorm, previousCourses = [] } = req.body;

    if (!email || !password || !name || !major || !year || !dorm) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, password, name, major, year, and dorm are required' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
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
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
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
    console.error('Login error:', error);
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
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { major, year, dorm, previousCourses } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (major !== undefined) user.major = major;
    if (year !== undefined) user.year = year;
    if (dorm !== undefined) user.dorm = dorm;
    if (previousCourses !== undefined) {
      const filteredPreviousCourses = (previousCourses || []).map(course => ({
        courseCode: course.courseCode,
        term: course.term
      })).filter(course => course.courseCode && course.term);
      user.previousCourses = filteredPreviousCourses;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

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

    user.completedCourses = user.completedCourses || [];
    courses.forEach(course => {
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
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('Found user, previousCourses:', user.previousCourses);
    res.json(user.previousCourses || []);
  } catch (error) {
    console.error('Error fetching user courses:', error);
    res.status(500).json({ error: 'Failed to fetch user courses' });
  }
});

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

app.post('/api/auth/semester-planner', authenticateToken, async (req, res) => {
  try {
    const { semesterName, classes } = req.body;

    if (!semesterName || !Array.isArray(classes)) {
      return res.status(400).json({ error: 'Semester name and classes array are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mappedClasses = classes.map(cls => ({
      courseId: cls.id || cls.courseId,
      code: cls.code,
      name: cls.name,
      hours: cls.hours || 3,
      subject: cls.subject,
      term: cls.term,
      sectionNumber: cls.sectionNumber,
      sectionType: cls.sectionType,
      active: cls.active,
      
      schedule: cls.schedule ? {
        days: Array.isArray(cls.schedule.days) ? cls.schedule.days : [cls.schedule.days],
        startTime: cls.schedule.startTime,
        endTime: cls.schedule.endTime,
        location: cls.schedule.location || 'TBA'
      } : null,
      
      professors: Array.isArray(cls.professors) ? cls.professors : [],
      rmpData: cls.rmpData || {},
      addedAt: new Date()
    }));

    user.currentSemesterPlan = {
      semesterName,
      classes: mappedClasses,
      lastUpdated: new Date()
    };

    await user.save();

    res.json({ 
      message: 'Semester planner saved successfully', 
      plan: user.currentSemesterPlan 
    });
  } catch (error) {
    console.error('Save semester planner error:', error);
    res.status(500).json({ error: 'Failed to save semester planner' });
  }
});

app.get('/api/auth/semester-planner', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plan = user.currentSemesterPlan || {
      semesterName: '',
      classes: [],
      lastUpdated: null
    };

    res.json(plan);
  } catch (error) {
    console.error('Get semester planner error:', error);
    res.status(500).json({ error: 'Failed to fetch semester planner' });
  }
});

app.delete('/api/auth/semester-planner/class/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.currentSemesterPlan || !user.currentSemesterPlan.classes) {
      return res.status(404).json({ error: 'No semester plan found' });
    }

    const beforeCount = user.currentSemesterPlan.classes.length;
    user.currentSemesterPlan.classes = user.currentSemesterPlan.classes.filter(
      cls => cls.courseId !== courseId && cls.id !== courseId
    );
    const afterCount = user.currentSemesterPlan.classes.length;

    user.currentSemesterPlan.lastUpdated = new Date();
    await user.save();

    res.json({ 
      message: 'Class removed successfully',
      plan: user.currentSemesterPlan
    });
  } catch (error) {
    console.error('Remove class error:', error);
    res.status(500).json({ error: 'Failed to remove class' });
  }
});

app.put('/api/auth/semester-planner/class/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const updatedClass = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.currentSemesterPlan || !user.currentSemesterPlan.classes) {
      return res.status(404).json({ error: 'No semester plan found' });
    }

    const classIndex = user.currentSemesterPlan.classes.findIndex(
      cls => cls.courseId === courseId || cls.id === courseId
    );

    if (classIndex === -1) {
      return res.status(404).json({ error: 'Class not found in planner' });
    }

    user.currentSemesterPlan.classes[classIndex] = {
      ...user.currentSemesterPlan.classes[classIndex],
      ...updatedClass,
      courseId: courseId,
      addedAt: user.currentSemesterPlan.classes[classIndex].addedAt
    };

    user.currentSemesterPlan.lastUpdated = new Date();
    await user.save();

    res.json({ 
      message: 'Class updated successfully',
      plan: user.currentSemesterPlan
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Only start server in non-production (for local development)
if (process.env.NODE_ENV !== 'production') {
  mongoose.connect(process.env.MONGO_URI, {
    dbName: 'Users'
  })
    .then(() => {
      console.log('✅ MongoDB connected to Users database');
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
}

// Add these endpoints to your server.js file (after the existing endpoints)

// Search users by email or name (authenticated users only)
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    
    // Search by email or name, excluding the current user
    const users = await User.find({
      _id: { $ne: req.user.userId }, // Exclude current user
      $or: [
        { email: searchRegex },
        { name: searchRegex }
      ]
    })
    .select('email name major year dorm') // Only return public info
    .limit(20); // Limit results

    res.json(users);
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get a specific user's public profile and semester planner
app.get('/api/users/:userId/public-profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('email name major year dorm currentSemesterPlan');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return public profile with semester planner
    const publicProfile = {
      email: user.email,
      name: user.name,
      major: user.major,
      year: user.year,
      dorm: user.dorm,
      semesterPlan: user.currentSemesterPlan || {
        semesterName: '',
        classes: [],
        lastUpdated: null
      }
    };

    res.json(publicProfile);
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Export for Vercel serverless
export default app;