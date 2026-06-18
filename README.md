# ServTech Rwanda
### Automated Client Acquisition and Registration System
**AUCA Final Year Project - June 2026**

---

## Overview

ServTech Rwanda is a web-based automated client registration system built for Rwanda's service and betting industry. It replaces paper-based onboarding with a digital workflow that scans a client's national ID using OCR, verifies their identity against a registry, and saves their record - reducing registration time from 15-20 minutes to an estimated 5-8 minutes.

Built entirely on free, open-source technologies at near-zero cost.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js (Vite) + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| OCR | Tesseract.js (client-side) |
| Auth | JWT + bcrypt |
| Frontend hosting | Netlify |
| Backend hosting | Render |
| Database hosting | Supabase |

---

## Project Structure

```
servtech-rwanda/
├── client/                  # React frontend
│   ├── src/
│   │   ├── context/         # Auth context and state
│   │   ├── pages/           # Login, Dashboard, Register, AgentRegister, AuditLog
│   │   ├── components/      # Reusable UI components
│   │   └── utils/           # OCR processing utilities
│   └── .env.example
│
├── server/                  # Node.js backend
│   ├── config/              # Database connection, schema, seed
│   ├── controllers/         # Business logic
│   ├── middleware/          # Auth middleware
│   ├── routes/              # API route definitions
│   └── .env.example
│
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js v18 or higher
- PostgreSQL 14 or higher
- npm

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/servtech-rwanda.git
cd servtech-rwanda
```

### 2. Set up the database
```bash
psql -U postgres
CREATE DATABASE servtech_db;
\c servtech_db
```
Then run the files in order:
```bash
\i server/config/schema.sql
\i server/config/seed.sql
```

### 3. Configure environment variables

Copy and fill in the example env files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env`
```
PORT=5000
JWT_SECRET=your_secret_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/servtech_db
CLIENT_URL=http://localhost:5173
```

`client/.env`
```
VITE_API_URL=http://localhost:5000/api
```

### 4. Install dependencies and run

Backend:
```bash
cd server
npm install
npm run dev
```

Frontend (new terminal):
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`

### 5. Default login credentials

| Role  | Email                 | Password |
|-------|-----------------------|----------|
| Admin | admin@servtech.rw     | password |
| Agent | agent@servtech.rw     | password |

---

## Features

### Self-Service Registration (OCR)
Client or staff uploads a photo of a national ID. Tesseract.js scans the document in the browser, extracts name, ID number, and date of birth, and pre-fills the registration form. The user reviews and corrects any errors before submitting.

### Agent-Assisted Registration
A simplified manual form for clients who prefer or require staff assistance. The agent enters the ID number, the system looks it up in the registry, and auto-fills available details.

### Identity Verification
All submitted ID numbers are checked against a seeded registry of Rwandan ID records. Matched clients are instantly marked as verified. Unmatched clients are marked as pending for manual review. The verification layer is built to accept a live NIDA API connection through the same interface when access is obtained.

### Admin Dashboard
Live stats showing total, verified, pending, and today's registrations. Searchable and filterable client table with pagination. Accessible to admin and agent roles.

### Audit Log
Full chronological record of every system action including logins, registrations, and verifications. Filterable by action type and user. Admin access only. Built for compliance with Rwanda's Law No. 058/2021 on personal data protection.

---

## API Endpoints

| Method | Endpoint          | Access | Description                    |
|--------|-------------------|--------|-------------------------------|
| POST   | /api/auth/login   | Public | Login and receive JWT token    |
| GET    | /api/auth/me      | Auth   | Get current user details       |
| POST   | /api/verify-id    | Auth   | Check ID against registry      |
| POST   | /api/register     | Auth   | Register a new client          |
| GET    | /api/clients      | Auth   | Get paginated client list      |
| GET    | /api/stats        | Auth   | Get dashboard statistics       |
| GET    | /api/audit-logs   | Admin  | Get paginated audit log        |
| GET    | /api/users        | Admin  | Get all system users           |

---

## Security

- Passwords hashed with bcrypt (10 salt rounds)
- Sessions managed with JWT tokens (8 hour expiry)
- All database queries parameterised (SQL injection prevention)
- Rate limiting: 100 req/15min globally, 10 req/15min on login
- File upload validation (type and size checks)
- Role-based access control (admin vs agent)
- Response compression enabled
- HTTPS enforced via hosting platforms
- All actions logged for audit compliance

---

## Architecture Decisions

**Why Tesseract.js client-side?**
Running OCR in the browser means full-resolution ID images are never transmitted to the server, keeping per-registration data transfer under 2MB. This is critical for users on limited mobile data plans in Rwanda.

**Why a seeded registry instead of live NIDA API?**
NIDA API access requires formal approval with an uncertain timeline. The verification layer is built as an abstraction that accepts NIDA, Smile ID, or the local seeded registry through the same interface. Swapping in a live API requires only a config change.

**Why a responsive web app instead of a native app?**
Eliminates the 50-100MB download barrier associated with native app installation. Works on any device with a browser. Reduces development cost and long-term maintenance burden.

**Why PostgreSQL on Supabase free tier?**
No licensing cost. Handles the prototype scale of 100-200 monthly registrations comfortably within free tier limits. Upgrade path to paid tier is straightforward as usage grows.

---

## Limitations

- OCR accuracy is 85-90% (Tesseract) vs 99% for commercial engines. Mitigated by the user correction layer.
- Identity verification uses a seeded dataset, not a live government API. Production deployment requires NIDA API approval.
- Free hosting introduces cold-start latency of approximately 30 seconds on Render after periods of inactivity.
- Not audited for enterprise-grade security. A professional penetration test is required before production use at scale.
- Tested at prototype scale only. Load testing at production scale has not been conducted.

---

## Maintenance Guide

**Adding a new user**
Insert into the `users` table with a bcrypt-hashed password. Use `bcrypt.hash('password', 10)` in a Node script to generate the hash.

**Adding more seed ID records**
Insert into the `id_records` table following the existing format. Rwanda national IDs follow the pattern `1YYYYXX########`.

**Swapping in live NIDA API**
In `server/controllers/registrationController.js`, replace the `id_records` query in `verifyId` with a call to the NIDA API endpoint using the same request/response interface.

**Upgrading hosting**
- Frontend: upgrade Netlify plan for higher bandwidth limits
- Backend: upgrade Render to a paid instance to eliminate cold-start latency
- Database: upgrade Supabase plan for higher storage and connection limits

**Common issues**
- `ECONNREFUSED` on backend start: PostgreSQL is not running. Start the service and retry.
- Blank page on frontend: check that `VITE_API_URL` is set correctly in the env file.
- JWT errors after server restart: tokens issued before a `JWT_SECRET` change are invalidated. Users must log in again.

---

## References

- Betway Africa (2022). Digital transformation in Sub-Saharan Africa.
- Rwanda Utilities Regulatory Authority (2021). Law No. 058/2021 on personal data protection.
- Smith, R. (2007). An overview of the Tesseract OCR engine. ICDAR 2007.
- Smile ID (2023). African identity verification documentation.
- Tesseract OCR (2023). https://github.com/tesseract-ocr/tesseract

---

*Adventist University of Central Africa (AUCA) - School of Information Technology - June 2026*
