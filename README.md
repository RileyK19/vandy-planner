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
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the root or `client` directory:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/
```

### 5. Populate the Database

#### (a) Populate Vanderbilt CS Courses
```bash
npm run scrape
```
Fetches Computer Science courses from the YES API and saves them to MongoDB.

#### (b) Collect RateMyProfessor Data
```bash
npm run collect-rmp
```
Fetches instructor ratings from RMP and merges them with existing course data.

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

## ⚖️ License

This project is **private** and not licensed for public distribution.
