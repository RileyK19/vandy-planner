import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001; // Changed to 3001

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

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));