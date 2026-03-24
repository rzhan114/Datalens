# DataLens — Job Market Analytics Platform

A full-stack analytics platform for exploring job market data. Upload job listing datasets, query them through a custom-built query engine, and visualize salary benchmarks, hiring competition, and opportunity analysis across industries and companies.

## Tech Stack

- **Backend**: TypeScript, Node.js, Express.js
- **Frontend**: React, Vite, Recharts
- **Auth**: JWT (jsonwebtoken) + per-IP rate limiting
- **Data**: ZIP ingestion pipeline, file system JSON persistence

## Features

- Custom JSON query engine supporting WHERE / GROUP BY / APPLY / ORDER operations
- LRU cache for query results with SHA-256 keys and TTL invalidation
- JWT authentication + Express rate limiting middleware
- Three analytics views:
  - **Salary Benchmark** — compare pay for the same role across companies
  - **Competition Index** — acceptance rate (openings ÷ applicants) per company
  - **Best Opportunities** — scatter plot of salary vs acceptance rate to find the sweet spot
- Real data ingestion via RemoteOK public API and BeautifulSoup scraper
- Docker + docker-compose support
- GitHub Actions CI pipeline

## Getting Started

### Prerequisites

- Node.js v24+
- Yarn v1.22+
- Python 3 (for data scripts)

### 1. Install dependencies

```bash
# Backend
yarn install

# Frontend
cd frontend/public/my-app
npm install
```

### 2. Start the backend

```bash
yarn start
# Server runs on http://localhost:1220
```

### 3. Load data

```bash
# Option A: generate synthetic dataset (no network required)
python3 scripts/generate_dataset.py

# Option B: scrape real listings from RemoteOK
python3 scripts/scrape_jobs.py --source remoteok

# Upload the dataset
TOKEN=$(curl -s -X POST http://localhost:1220/auth/token \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"datalens-dev-key"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -X PUT "http://localhost:1220/api/v1/dataset/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @data/jobs_market.zip
```

### 4. Start the frontend

```bash
cd frontend/public/my-app
npm run dev
# App runs on http://localhost:5173
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/token` | Get JWT token |
| PUT | `/api/v1/dataset/:id` | Upload dataset ZIP |
| DELETE | `/api/v1/dataset/:id` | Remove dataset |
| GET | `/api/v1/datasets` | List all datasets |
| POST | `/api/v1/query` | Run a custom query |
| GET | `/api/v1/analytics/:id/industries` | List industries |
| GET | `/api/v1/analytics/:id/salary-benchmark/:role` | Salary by company for a role |
| GET | `/api/v1/analytics/:id/competition/:industry` | Acceptance rate by company |

## Docker

```bash
docker-compose up --build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `1220` | Server port |
| `JWT_SECRET` | `datalens-dev-secret` | JWT signing secret |
| `API_KEY` | `datalens-dev-key` | API key for token endpoint |
