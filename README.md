# Vandy Planner App

Planner app to integrate with Vanderbilt's YES portal for registration. Web app made through MERN stack to make registration easier for students.

## Features

- Seamless class search with filtering by requirement 
- RateMyProfessor integration with course-instructor specific ratings
- Automatic class detection for new semesters through API
- Class recommendations
- Degree audit visualization and display what classes you need to take
- What-if scenarios to visualize what if you get into a certain class or if you change your major
- Preferences survey to incorporate preferred times, professors, and locations, and desired workload

## Reach Features

- How difficult my schedule is to get into the classes
- Connect with friends and coordinate classes
- Export schedule into calendar apps
- Visualize schedule through blank transcript template
- Import classes through unofficial transcript to detect taken classes

## Tech Stack

- **Frontend:** React, Vite, TypeScript
- **Backend:** Node.js, Express
- **Database:** MongoDB Atlas
- **Deployment:** Vercel

## APIs Used

- **Rate My Professor:** `rate-my-professor-api-ts`
- **Vanderbilt Classes:** `@vanderbilt/yes-api` 
  - Documentation: https://courses.clubfair.io/

## Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- MongoDB Atlas account

### 1. Clone Repository
```bash
git clone [your-repo-url]
cd vandy-planner/client
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the client directory:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

### 4. Database Population

#### Populate CS Courses
```bash
# First, populate the database with Vanderbilt CS courses
npm run scrape
```

This will:
- Connect to Vanderbilt's YES API
- Fetch all Computer Science courses for recent terms
- Store course data in `vanderbilt_courses.cs_sections` collection

**Note:** Make sure to update database and cluster names in `scrape-cs-courses.js` before running.

#### Collect RateMyProfessor Data
```bash
# After courses are populated, collect RMP ratings
npm run collect-rmp
```

This will:
- Read course-instructor pairs from your CS courses database
- Fetch ratings from RateMyProfessor for each instructor
- Calculate average quality and difficulty ratings
- Store results in `vanderbilt_courses.rmp_instructor_averages` collection
- Takes ~12-15 minutes to complete (497 instructor pairs with API rate limiting)

### 5. Start Development Server
```bash
npm run dev
```

The React app will be available at `http://localhost:5173`

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start React development server |
| `npm run build` | Build production version |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run scrape` | Populate database with CS courses |
| `npm run collect-rmp` | Collect RateMyProfessor data |
| `npm run test-api` | Test API connections |

## Database Schema

### CS Courses (`vanderbilt_courses.cs_sections`)
```json
{
  "_id": "ObjectId",
  "sectionId": "5062",
  "termId": "1055",
  "termTitle": "2025 Fall",
  "subject": "CS",
  "abbreviation": "CS 1100",
  "courseName": "Applied Programming and Problem Solving with Python",
  "sectionNumber": "21",
  "sectionType": "Lecture",
  "schedule": "MWF;11:15a-12:05p",
  "instructors": ["Hasan, Md Kamrul"],
  "hours": 3,
  "lastUpdated": "2025-01-21T...",
  "dataSource": "vanderbilt-yes-api"
}
```

### RMP Ratings (`vanderbilt_courses.rmp_instructor_averages`)
```json
{
  "_id": "ObjectId",
  "courseId": "CS 1101",
  "courseName": "Programming and Problem Solving",
  "instructorName": "John Smith",
  "averageQuality": 4.2,
  "averageDifficulty": 3.1,
  "lastUpdated": "2025-01-21T..."
}
```

## Development Notes

### Data Collection Process
1. **Course Data**: Collected from Vanderbilt's YES API for recent terms (Fall 2025, Spring 2025, Summer 2025, etc.)
2. **RMP Data**: Collected using the `rate-my-professor-api-ts` package with proper rate limiting (1.5s delays)
3. **Data Matching**: Course-instructor pairs are matched between YES data and RMP data by cleaned instructor names

### Rate Limiting
- RateMyProfessor API calls are limited to 1 request per 1.5 seconds
- Data is saved every 50 records to prevent data loss
- Progress is logged every 10 records

### Error Handling
- Scripts continue processing even if individual instructors aren't found on RMP
- Database connection is tested before saving data
- Detailed error logging for debugging

## Project Structure
```
client/
├── src/                    # React source code
├── scrape-cs-courses.js    # CS course data collection
├── collect-rmp-data.ts     # RateMyProfessor data collection
├── test-api.js            # API testing utilities
├── .env                   # Environment variables
└── package.json           # Dependencies and scripts
```

## Resources

- **Trello Board**: https://trello.com/b/goYUQhKw/vandy-planner
- **Vanderbilt YES API**: https://courses.clubfair.io/
- **RateMyProfessor API**: https://www.npmjs.com/package/rate-my-professor-api-ts

## License

This project is private and not licensed for public use.