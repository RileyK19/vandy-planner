# 🧭 Vandy Planner

**Vandy Planner** is a full-stack web app built to streamline Vanderbilt University’s course registration experience. It integrates with the YES portal and RateMyProfessor to help students **plan, visualize, and optimize** their academic paths.

🌐 **Live Demo:** [https://vandy-planner.vercel.app/](https://vandy-planner.vercel.app/)  
🧠 Built with the **MERN stack** (MongoDB, Express, React, Node.js), deployed on **Vercel**.

---

## 🚀 Features

### Core Tools
- **1-Semester Planner** – Drag-and-drop course scheduling with conflict detection.
- **4-Year Planner** – Visualize your degree progress semester-by-semester.
- **Recommendation Engine** – Suggests classes based on degree progress, preferences, and past selections.
- **Degree Audit** – Displays remaining degree requirements and “what-if” major changes.
- **Smart Search** – Find courses by requirements, time, professor, or difficulty.

### Integrations
- **RateMyProfessor API** – Pulls course-instructor ratings to inform course decisions.
- **YES Portal API** – Syncs live Vanderbilt course data automatically.
- **Preference Survey** – Incorporates student inputs (preferred times, difficulty, location) into suggestions.

### Experimental / Planned Features
- Admission difficulty estimates (“How hard is it to get into my schedule?”)
- Friend planner to coordinate classes with peers
- Schedule export (Google Calendar / Apple Calendar)
- Transcript upload and class auto-detection from unofficial transcript

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React + Vite + TypeScript |
| **Backend** | Node.js + Express |
| **Database** | MongoDB Atlas (via Mongoose) |
| **Deployment** | Vercel |
| **Testing** | Jest + Testing Library |
| **Other Tools** | dotenv, multer, cors, pdf-parse |

---

## 🔗 APIs Used

- **RateMyProfessor API:** [`rate-my-professor-api-ts`](https://www.npmjs.com/package/rate-my-professor-api-ts)
- **Vanderbilt YES API:** [`@vanderbilt/yes-api`](https://courses.clubfair.io/)

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js ≥ 18  
- npm or yarn  
- MongoDB Atlas account

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/vandy-planner.git
cd vandy-planner
```

### 3. Install Dependencies

#### Install Client Dependencies
```bash
cd client
npm install
```

#### Install Server Dependencies
```bash
cd ../server
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the `server` directory:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/vanderbilt_courses
PORT=5000
```

### 5. Populate the Database

From the `scripts` directory:

#### (a) Populate Vanderbilt Courses
```bash
cd scripts
node populate-courses.cjs
```
Fetches course data from the Vanderbilt YES API and saves them to MongoDB.

#### (b) Populate RateMyProfessor Ratings
```bash
npx tsx populate-ratings.tsx
```
Fetches instructor ratings from RMP and merges them with existing course data.

> **Note:** You may need to install `tsx` globally first: `npm install -g tsx`

### 6. Run the Application

#### Start the Backend Server
From the `server` directory:
```bash
node index.js
```
The server will run on `http://localhost:5000`

#### Start the Frontend (in a new terminal)
From the `client` directory:
```bash
npm start
```
The React app will run on `http://localhost:3000` (or the next available port)

---

## 🧪 Scripts

| Command | Description |
|----------|-------------|
| `npm run dev` | Start local development server (Vite) |
| `npm run build` | Build production-ready bundle |
| `npm run preview` | Preview production build locally |
| `npm run scrape` | Fetch and store Vanderbilt course data |
| `npm run collect-rmp` | Fetch and store RateMyProfessor data |
| `npm run test` | Run Jest test suite |
| `npm run lint` | Run ESLint checks |

---

## 🗄️ Database Overview

### `vanderbilt_courses.cs_sections`
```json
{
  "termTitle": "2025 Fall",
  "subject": "CS",
  "abbreviation": "CS 1100",
  "courseName": "Applied Programming and Problem Solving with Python",
  "instructors": ["Hasan, Md Kamrul"],
  "hours": 3,
  "schedule": "MWF;11:15a-12:05p"
}
```

### `vanderbilt_courses.rmp_instructor_averages`
```json
{
  "courseId": "CS 1101",
  "instructorName": "John Smith",
  "averageQuality": 4.2,
  "averageDifficulty": 3.1
}
```

---

## 🧠 Data Pipeline

1. **Fetch course data** from the Vanderbilt YES API (CS and related subjects).
2. **Match instructors** to RMP profiles via the `rate-my-professor-api-ts` package.
3. **Aggregate ratings** (quality, difficulty) per instructor and store in MongoDB.
4. **Serve combined data** through Express API endpoints consumed by the React client.

---

## 📂 Project Structure

```
vandy-planner/
├── api/                # API routes (Vercel serverless functions)
├── client/             # React frontend (Vite + TS)
├── server/             # Express backend (Mongo, data population scripts)
├── scripts/            # Utility scripts for scraping, populating, testing
├── onboarding_tests/   # Onboarding UI + integration tests
├── assets/             # Logos and static images
└── vercel.json         # Vercel deployment config
```

---

## 🧭 Resources

- **Trello Board:** [Project Management](https://trello.com/b/goYUQhKw/vandy-planner)  
- **Vanderbilt YES API:** [courses.clubfair.io](https://courses.clubfair.io/)  
- **RateMyProfessor API:** [npm package](https://www.npmjs.com/package/rate-my-professor-api-ts)

---

### License

```
MIT License

Copyright (c) 2025 R. Koo, K. Song, E. You

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
