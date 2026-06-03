[README.md](https://github.com/user-attachments/files/28556669/README.md)
# TradeLab

TradeLab is a virtual trading and learning platform for the KAIST CS350 Software Engineering project.
Users can practice simulated trading, track portfolio performance, enroll in trading courses, and join competitions. Instructors can create courses and competitions, and admins can manage users, courses, and competitions.

---

## Features

### User

* Register, verify email, log in, and log out
* View dashboard summary
* Buy and sell virtual assets
* Use 100% buy / sell shortcut
* View holdings, cash balance, total asset value, portfolio value, and ROI
* View asset allocation and price charts
* Enroll in courses and watch uploaded video lessons
* Join competitions and view leaderboards

### Instructor

* Create and manage courses
* Upload lessons and local MP4 video lectures
* View users enrolled in instructor-created courses
* Create and manage competitions
* View competition participants and leaderboard data

### Admin

* View registered users
* Check each user’s holdings, enrolled courses, and joined competitions
* View all courses
* Approve or reject instructor-created courses
* View instructors and their courses
* View all competitions and participants

### Market Simulation

TradeLab supports Alpha Vantage for market data, but because the free API has request limits, the project also includes a local market simulator.

* Simulated asset prices update automatically
* Portfolio values update based on simulated prices
* Competition leaderboard can reflect portfolio value changes

---

## Tech Stack

### Backend

* Node.js
* TypeScript
* Express
* MongoDB
* Mongoose
* JWT / HTTP-only cookie authentication
* Nodemailer
* Multer
* Alpha Vantage API

### Frontend

* React
* Vite
* Axios
* CSS

---

## Required Programs

Install the following before running the project.

* Git
* Node.js LTS and npm
* MongoDB Community Server
* MongoDB Compass, optional

---

## Setup

### 1. Clone the repository

```powershell
git clone https://github.com/sihyeonnim/TradeLab.git
cd TradeLab
```

### 2. Backend setup

```powershell
cd backend
npm install
```

Create `backend/.env` from `backend/.env.example`.

Example:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/tradelab
PORT=5000
CLIENT_URL=http://localhost:5173

JWT_SECRET=replace-with-your-secret
JWT_EXPIRES_IN=1d

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=TradeLab <your-email@gmail.com>

ALPHA_VANTAGE_API_KEY=replace-with-your-alpha-vantage-api-key

AUTO_MARKET_SIMULATOR_ENABLED=true
AUTO_MARKET_TICK_SECONDS=1
```

Run the seed script:

```powershell
npm run seed
```

Start the backend server:

```powershell
npm run dev
```

Backend runs at:

```txt
http://localhost:5000
```

---

### 3. Frontend setup

Open a new terminal.

```powershell
cd frontend
npm install
```

Create `frontend/.env` from `frontend/.env.example`.

Example:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend server:

```powershell
npm run dev
```

Frontend runs at:

```txt
http://localhost:5173
```

---

## Demo Accounts

After running the seed script, use these accounts.

```txt
User
email: user@tradelab.local
password: password123

Instructor
email: instructor@tradelab.local
password: password123

Admin
email: admin@tradelab.local
password: password123
```

---

## Main Pages

### User

```txt
/dashboard
/market
/courses
/competition
```

### Instructor

```txt
/instructor/courses
/instructor/competitions
```

### Admin

```txt
/admin/users
/admin/courses
/admin/competitions
```

---

## Notes

* This project uses virtual money only.
* No real financial transaction is executed.
* Do not commit `.env` files.
* Do not commit `node_modules`.
* Do not commit uploaded MP4 files in `backend/uploads/videos`.
* Keep real API keys only in `backend/.env`.
