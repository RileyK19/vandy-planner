// models/User.js - Add currentSemesterPlan to existing schema

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  major: {
    type: String,
    required: true
  },
  year: {
    type: String,
    required: true,
    enum: ['Freshman', 'Sophomore', 'Junior', 'Senior']
  },
  dorm: {
    type: String,
    required: true
  },
  
  // Courses the user has already completed
  previousCourses: [{
    courseCode: String,
    courseName: String,
    term: String,
    grade: String,
    completedAt: Date
  }],
  
  // EXISTING: Four-year planner (keep as is)
  plannedSchedules: [{
    scheduleName: String,
    classes: [{
      courseId: String,
      code: String,
      name: String,
      hours: Number,
      semester: String,
      subject: String,
      professors: [String],
      term: String,
      sectionNumber: String
    }],
    createdAt: Date
  }],
  
  // NEW: One-semester planner with detailed schedule info
  currentSemesterPlan: {
    semesterName: {
      type: String,
      default: ''
    },
    classes: [{
      courseId: String,
      code: String,
      name: String,
      hours: Number,
      subject: String,
      term: String,
      sectionNumber: String,
      sectionType: String,
      active: Boolean,
      
      // Detailed schedule information for calendar view
      schedule: {
        days: [String], // ['Monday', 'Tuesday', 'Wednesday']
        startTime: String, // '11:15'
        endTime: String, // '12:30'
        location: String // 'FGH 234'
      },
      
      // Professor information
      professors: [String],
      
      // RMP ratings data
      rmpData: mongoose.Schema.Types.Mixed,
      
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get user data without sensitive info
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;