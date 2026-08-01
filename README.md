# OCR-SUSTEM

Monorepo for the OCR-SUSTEM project — React frontend and Express backend.

## Project structure

```
OCR-SUSTEM/
├── frontend/     # React + Vite + Tailwind + React Router
├── backend/      # Node.js + Express + MongoDB
├── package.json  # Root scripts
└── README.md
```

### Backend layout

```
backend/src/
├── config/       # Database and app configuration
├── controllers/  # Request handlers
├── routes/       # API route definitions
├── services/     # Business logic
├── models/       # Mongoose schemas
├── middlewares/  # Express middleware
└── utils/        # Shared helpers
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [MongoDB](https://www.mongodb.com/) running locally **or** a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

## Setup

1. **Clone and install dependencies**

   ```bash
   npm run install:all
   ```

2. **Configure environment variables**

   Copy the backend example env file and edit values:

   ```bash
   cp backend/.env.example backend/.env
   ```

   | Variable        | Description                          |
   |-----------------|--------------------------------------|
   | `PORT`          | Backend server port (default: 5000)  |
   | `MONGODB_URI`   | MongoDB connection string            |
   | `GEMINI_API_KEY`| Google Gemini API key (for later)    |

   **Local MongoDB example:**

   ```
   MONGODB_URI=mongodb://localhost:27017/ocr-sustem
   ```

   **MongoDB Atlas example:**

   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ocr-sustem
   ```

3. **Start MongoDB** (if using local instance)

   Ensure MongoDB is running on `localhost:27017` before starting the backend.

## Running locally

Open two terminals:

**Terminal 1 — Backend**

```bash
npm run dev:backend
```

Server runs at `http://localhost:5000`.

**Terminal 2 — Frontend**

```bash
npm run dev:frontend
```

App runs at `http://localhost:5173`.

The Vite dev server proxies `/api/*` requests to the backend, so the frontend can call the API without CORS issues during development.

## Verify connectivity

1. **Health check (API)**

   ```bash
   curl http://localhost:5000/api/health
   ```

   Expected response:

   ```json
   {
     "status": "ok",
     "message": "Backend is running",
     "timestamp": "2026-08-01T..."
   }
   ```

2. **Hello page (frontend ↔ backend)**

   Open [http://localhost:5173](http://localhost:5173). The Hello page fetches `/api/health` and displays the backend response when connected.

## API endpoints

| Method | Path                  | Description              |
|--------|-----------------------|--------------------------|
| GET    | `/api/health`         | Server health check      |
| POST   | `/api/receipts`       | Create a receipt         |
| GET    | `/api/receipts`       | List all receipts        |
| GET    | `/api/receipts/:id`   | Get receipt by ID        |
| PUT    | `/api/receipts/:id`   | Update a receipt         |
| DELETE | `/api/receipts/:id`   | Delete a receipt         |

### Receipt fields

| Field                  | Type     | Required | Notes                                      |
|------------------------|----------|----------|--------------------------------------------|
| `lrNumber`             | string   | yes      | Duplicate check warns but does not block   |
| `date`                 | date     | yes      | ISO date string accepted                   |
| `consignor`            | string   | yes      |                                            |
| `consignee`            | string   | yes      |                                            |
| `destination`          | string   | yes      |                                            |
| `articles`             | string   | no       |                                            |
| `description`          | string   | no       |                                            |
| `invoiceNumber`        | string   | no       |                                            |
| `freightType`          | enum     | no       | `Paid` \| `To Pay` (default: `Paid`)       |
| `acknowledgementStatus`| enum     | no       | `Pending` \| `Received` \| `Later`         |
| `remarks`              | string   | no       |                                            |
| `imagePath`            | string   | no       | For OCR uploads (later sprints)            |
| `ocrConfidence`        | number   | no       | 0–100                                      |
| `enteredBy`            | string   | no       |                                            |
| `verificationStatus`   | enum     | no       | `Pending` \| `Verified` \| `Rejected`      |

### Example: create receipt

```bash
curl -X POST http://localhost:5000/api/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "lrNumber": "LR-1001",
    "date": "2026-08-01",
    "consignor": "ABC Traders",
    "consignee": "XYZ Stores",
    "destination": "Chennai"
  }'
```

Duplicate LR numbers return `201` with a `warnings` array instead of blocking creation.

### Test the receipts API

**Automated test script:**

```bash
cd backend
npm run test:receipts
```

**Postman / Thunder Client:**

Import `backend/postman/receipts.postman_collection.json`.

### Error response shape

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    { "field": "consignor", "message": "Consignor is required" }
  ]
}
```
