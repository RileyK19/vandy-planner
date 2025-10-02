import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB first, then define routes and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    
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


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));