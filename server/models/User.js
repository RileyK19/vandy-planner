import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const previousCourseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  term: {
    type: String,
    required: true,
    trim: true
  }
});

const plannedScheduleSchema = new mongoose.Schema({
  scheduleName: {
    type: String,
    required: true,
    trim: true
  },
  classes: [{
    courseId: String,
    code: String,
    name: String,
    hours: Number,
    semester: String,
    subject: String,
    professors: [String],
    term: String,
    sectionNumber: String,
    active: Boolean,
    schedule: {
      days: mongoose.Schema.Types.Mixed,
      startTime: String,
      endTime: String,
      location: String
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long']
  },
  major: {
    type: String,
    required: [true, 'Major is required'],
    trim: true,
    minlength: [2, 'Major must be at least 2 characters long']
  },
  year: {
    type: String,
    required: [true, 'Academic year is required'],
    enum: {
      values: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
      message: 'Year must be one of: Freshman, Sophomore, Junior, Senior, Graduate'
    }
  },
  dorm: {
    type: String,
    required: [true, 'Dorm location is required'],
    trim: true,
    minlength: [2, 'Dorm location must be at least 2 characters long']
  },
  previousCourses: [previousCourseSchema],
  plannedSchedules: [plannedScheduleSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Override toJSON to remove password from output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Create indexes
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);

export default User;
