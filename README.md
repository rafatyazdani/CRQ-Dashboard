# CRQ — Cyber Risk Quantification Dashboard

A consultant-operated, client-facing web app for FAIR-based cyber risk quantification.
Pre-load a client's risk profile and they see interactive financial models across 5 threat
scenarios, with ALE, VaR, cost-benefit, and loss exceedance outputs.

---

## Prerequisites

- Python 3.10+
- Node.js 18+

---

## Starting the App

Run these in **two separate PowerShell terminals** each time you want to use the app.

**Terminal 1 — Backend (FastAPI)**
```powershell
cd C:\Users\rafat.yazdani\CRQ\backend
.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend (React)**
```powershell
cd C:\Users\rafat.yazdani\CRQ\frontend
npm run dev
```

> First time only: run `npm install` before `npm run dev` in Terminal 2.

---

## Key URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:5173/dashboard/nexus-financial` | Client-facing dashboard (read-only) |
| `http://localhost:5173/dashboard/medcore-health` | MedCore Health client dashboard |
| `http://localhost:5173/dashboard/techvault-solutions` | TechVault Solutions client dashboard |
| `http://localhost:5173/consultant` | Consultant view — edit FAIR parameters |
| `http://localhost:5173/admin` | Admin panel — manage clients, generate reports, export PDF |
| `http://localhost:8000/docs` | API explorer (Swagger UI) |
| `http://localhost:8000/health` | Backend health check |

---

## Admin Panel

Go to `http://localhost:5173/admin` and enter the token from `backend/.env`:

```
ADMIN_TOKEN=changeme
```

Change this to something secret before sharing the app externally.

---

## Loading a New Client

1. Go to `http://localhost:5173/admin`
2. Log in with your admin token
3. Fill in the client name, industry, and FAIR parameters for each of the 5 threat scenarios
4. Click **Generate Report** to run the Monte Carlo simulation
5. Share `http://localhost:5173/dashboard/{client-id}` with the client

---

## Sample Clients (pre-loaded)

| Client | Industry | Risk Tier | Dashboard URL |
|--------|----------|-----------|---------------|
| Nexus Financial Group | Financial Services | High | `/dashboard/nexus-financial` |
| MedCore Health Systems | Healthcare | Critical | `/dashboard/medcore-health` |
| TechVault Solutions | Technology | Medium | `/dashboard/techvault-solutions` |

---

## Running Tests

With the backend virtual environment active:

```powershell
cd C:\Users\rafat.yazdani\CRQ\backend
.venv\Scripts\Activate.ps1
python -m pytest tests/ -v
```

---

## Project Structure

```
CRQ/
├── backend/
│   ├── main.py              # FastAPI app and routes
│   ├── fair_engine.py       # FAIR Monte Carlo engine (PERT distributions)
│   ├── admin_router.py      # Admin endpoints (auth-protected)
│   ├── pdf_generator.py     # PDF export via WeasyPrint
│   ├── limiter.py           # Rate limiting (slowapi)
│   ├── requirements.txt     # Python dependencies
│   ├── requirements-dev.txt # Test dependencies
│   ├── .env                 # Admin token (do not commit)
│   ├── data/
│   │   └── clients.json     # Client risk profiles
│   ├── reports/             # Cached Monte Carlo results
│   ├── templates/
│   │   └── report.html      # PDF report template
│   └── tests/
│       ├── test_fair_engine.py  # Unit tests (48 tests)
│       └── test_api.py          # API integration tests
└── frontend/
    └── src/
        ├── pages/           # ClientDashboard, ConsultantDashboard, AdminPanel
        └── components/      # ExecutiveSummary, ScenarioComparison, LossExceedanceCurve, etc.
```

---

## Methodology

This app implements the **FAIR (Factor Analysis of Information Risk)** model:

```
effective_vuln = VULN × (1 − DIFF)
LEF            = TEF  × effective_vuln
ALE            = LEF  × Loss Magnitude
```

Each scenario runs **10,000 Monte Carlo simulations** using PERT (Beta) distributions
for TEF, DIFF, VULN, and Loss Magnitude inputs.
