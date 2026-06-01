# TradeLab

A paper-trading web app for practicing stock trades without real money.

## Tech Stack

| Layer    | Technology                     |
| -------- | ------------------------------ |
| Frontend | React + Vite (port 5173)       |
| Backend  | Node.js + Express + TypeScript |
| Database | MongoDB (Mongoose)             |
| Auth     | JWT (HTTP-only cookie)         |
| Market   | Finnhub API (optional)         |

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas URI
- (Optional) [Finnhub](https://finnhub.io/dashboard) free API key for live prices

### 1. Clone & install

```bash
git clone https://github.com/sihyeonnim/TradeLab.git
cd TradeLab

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in at minimum:

| Variable          | Description                        |
| ----------------- | ---------------------------------- |
| `MONGODB_URI`     | MongoDB connection string          |
| `JWT_SECRET`      | Long random string for JWT signing |
| `FINNHUB_API_KEY` | (Optional) live price data         |

### 3. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:5000

### Docker (optional)

```bash
docker compose up
```

## Project Structure

```
TradeLab/
├── backend/          # Express API (TypeScript)
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   └── .env.example
└── frontend/         # React + Vite
    └── src/
        └── pages/
```

## API Endpoints

| Method | Path                 | Description    |
| ------ | -------------------- | -------------- |
| POST   | `/api/auth/register` | Create account |
| POST   | `/api/auth/login`    | Login          |
| POST   | `/api/auth/logout`   | Logout         |
| GET    | `/api/health`        | Health check   |
| GET    | `/api/dashboard`     | Dashboard data |
