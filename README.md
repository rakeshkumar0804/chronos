# CHRONOS
### Constraint-Based Timetable Scheduling Engine with Live Algorithm Visualization

![CI Status](https://github.com/rakeshkumar0804/chronos/actions/workflows/ci.yml/badge.svg) ![stack](https://img.shields.io/badge/stack-React_18_%7C_Express_%7C_PostgreSQL_%7C_Gemini-blue) ![typecheck](https://img.shields.io/badge/typecheck-0_errors_%2F_5_workspaces-brightgreen) ![nl-parser tests](https://img.shields.io/badge/nl--parser_tests-7%2F7_passing-brightgreen)

CHRONOS is a hand-written **Constraint Satisfaction Problem (CSP) solver** that generates conflict-free academic timetables — and lets you *watch it think*. It exposes the internal search process (backtracking, forward-checking domain pruning, conflict resolution) as a live, animated search tree, and features a hybrid Natural Language interface powered by Google Gemini for injecting real-world scheduling rules.

Built on a real academic dataset: the 5th-semester Computer Science & Engineering timetable structure of an engineering institute (11 courses, 12 faculty members, 4 rooms, 2 student divisions, 46 weekly required sessions), with synthetic faculty profiles for privacy.

---

## 🔴 Live Interactive Demo

**[chronos-web-kappa.vercel.app](https://chronos-web-kappa.vercel.app)**

Try it live in your browser — zero installation required:
1. Click **"Naive vs Smart Bottleneck Demo"** to load the institutional benchmark problem.
2. Run it in **Chronological (Naive)** mode — watch the solver hit a bounded search limit after 1,000 backtracks due to greedy early variable selection.
3. Switch to **MRV + LCV (Smart)** and re-run — watch the solver schedule all 46 sessions in exactly 46 steps with **0 backtracks**.
4. Type a real-world constraint in the **NL Constraint Injector** (e.g., *"Room 132 is undergoing maintenance on Friday morning"*) to watch Gemini parse, validate, and apply the rule live.

*(Note: The backend API is hosted on Render free-tier, which may take a few seconds to wake up on the first request.)*

---

## 🎯 Architectural Philosophy: Deterministic Solver + LLM Interface

Most "AI scheduling" applications wrap a prompt around a Large Language Model and hope it doesn't hallucinate an invalid schedule. CHRONOS takes the opposite approach:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NATURAL LANGUAGE INPUT                           │
│           "Prof. Karan Rathi is on leave on Monday and Tuesday"             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE GEMINI (Structured JSON Mode)                     │
│                  Translates English -> Structured Rule Schema               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PRISMA ORM & DATABASE VALIDATION LAYER                    │
│      Validates entity codes (KR), room capacities, and workspace scopes     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PURE DETERMINISTIC ES6 GENERATOR SOLVER                   │
│          Hand-written CSP Engine with MRV, LCV, and AC-3 Pruning             │
│            (Zero external dependencies, 100% reproducible math)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Deterministic Core Solver**: Hand-written TypeScript CSP algorithm (zero external optimization/solver libraries). Given identical inputs, it produces byte-identical, 100% conflict-free timetables every time.
- **LLM Boundary Scoping**: Google Gemini is used **exclusively** for natural language rule parsing. It converts unstructured English sentences into strict JSON schemas, which are then validated against PostgreSQL entity records before reaching the solver. The LLM never touches the actual scheduling logic.

---

## 📊 Benchmark Metrics: Naive vs. Smart Search

CHRONOS measures hardware-independent algorithmic counters for every search execution:
- **Nodes Explored (`nodesExplored` / `VALUE_TRIED`)**: Total candidate assignment attempts evaluated during search tree traversal.
- **Backtracks (`backtrackCount` / `BACKTRACK`)**: Decision points where search was forced to undo a tentative assignment due to domain wipeout or hard constraint collision.

### 1. Live Interactive Browser UI Benchmark (`maxBacktracks = 1,000`)

| Search Strategy | Outcome Status | Nodes Explored | Backtracks | Execution Time |
|---|---|---|---|---|
| **Chronological (Unguided Naive)** | Bounded Limit Hit (`HIT_CAP`) | **1,046** | **1,000** | **~1.6 ms** |
| **MRV + LCV (Constraint-Guided Smart)** | Solved (`NATURALLY_CONVERGED_SOLVED`) | **46** | **0** | **~1.2 ms** |

*(In the live UI, Naive Chronological mode is capped at a responsive budget of 1,000 backtracks to prevent main-thread freezing. Once 1,000 backtracks are unwound, search halts and explicitly returns `HIT_CAP`.)*

### 2. Historical Uncapped Offline Benchmark (`maxBacktracks = 10,000,000`)

| Search Strategy | Outcome Status | Nodes Explored | Backtracks | Machine Execution Time |
|---|---|---|---|---|
| **Chronological (Unguided Naive Uncapped)** | Bounded Limit Hit (`HIT_CAP`) | **10,001,246** | **10,001,246** | ~98.4s *(machine-specific)* |
| **MRV + LCV (Constraint-Guided Smart)** | Solved (`NATURALLY_CONVERGED_SOLVED`) | **46** | **0** | ~75ms *(machine-specific)* |

*(The uncapped run proves that unguided chronological search fails to converge on this dataset even when granted an offline budget of 10 million backtracks.)*

---

## 🧩 How the Solver Works

The timetable problem is modeled as a classic Constraint Satisfaction Problem:

- **Variables (46 total)**: One per required course session per division (e.g., `5A15-1_DAA_1`, `5A15-2_SE-L_2`).
- **Domains**: Every legal tuple `(Day, TimeSlot, Room, Faculty)` matching course requirements, room types (LAB vs. LECTURE_ROOM), and instructor qualifications.
- **Hard Constraints**:
  1. **No Faculty Double-Booking**: An instructor cannot teach two sessions simultaneously.
  2. **No Room Double-Booking**: A room cannot host two classes in the same slot.
  3. **No Division Double-Booking**: Student divisions cannot attend two subjects at once.
  4. **Room Compatibility**: Lab courses must be placed in lab rooms.
  5. **No Break Slot Assignments**: Recess and lunch slots are kept free.
  6. **Daily Course Session Limits**: Maximum daily frequency rules per subject per division.

### Heuristics & Techniques

- **Minimum Remaining Values (MRV)**: Selects the unassigned variable with the smallest remaining legal domain size first, tackling bottleneck constraints before legal options collapse.
- **Least Constraining Value (LCV)**: Orders candidate domain values by prioritizing options that maximize flexibility for neighboring variables.
- **Forward Checking (AC-3 Domain Pruning)**: After each assignment, immediately prunes invalidated choices from future domains, detecting dead ends before deep recursive backtracks.
- **Deterministic Tie-Breaking**: Breaks heuristic ties using a stable sort on entity keys (course code, faculty short code) to eliminate database query ordering variance across runs.

---

## 🛡️ Workspace Partitioning & Tenant Isolation

CHRONOS supports multi-workspace execution while guaranteeing institutional dataset safety:

- **Protected Institutional Benchmark Workspace (`xyz-institute-demo`)**: The official 46-session benchmark dataset is guarded by database-level Prisma middleware. Unauthorized public `CREATE`, `UPDATE`, `DELETE`, or `RESET` mutations against `xyz-institute-demo` are blocked with a `403 Forbidden` response.
- **Visitor Sandbox Workspaces (`ws-<uuid>`)**: Visitors can freely inject custom courses, faculty, rooms, and constraints via the **Quick Add** panel. Injected entities are partitioned using client-assigned workspace tokens stored in `localStorage`.
- **Scoped Sandbox Reset**: A "Reset Sandbox" action clears visitor custom entities without touching the protected benchmark or other visitors' active sessions.

---

## 🏗️ Monorepo Architecture

```
CHRONOS Monorepo (npm workspaces)
├── apps/
│   ├── api/             # Express 4 + TypeScript REST API (Prisma ORM, Security Middleware)
│   └── web/             # React 18 + Vite Frontend (D3.js Tree, Web Worker Solver)
├── packages/
│   ├── shared/          # Shared TypeScript interfaces & Prisma schema types
│   ├── solver/          # Pure ES6 Generator CSP Solver Engine (Zero dependencies)
│   └── nl-parser/       # Gemini Natural Language Parser + Deterministic Fallback
├── prisma/
│   ├── schema.prisma    # PostgreSQL Schema (Courses, Faculty, Rooms, Schedules)
│   └── seed.ts          # Scoped, Idempotent Institutional Seed Script
└── .github/
    └── workflows/
        └── ci.yml       # GitHub Actions Automated CI & Quality Pipeline
```

---

## 💻 Local Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (Local or Disposable container)

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/rakeshkumar0804/chronos.git
cd chronos

# 2. Install monorepo dependencies
npm install

# 3. Environment configuration
# Create .env in root (or apps/api/.env)
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chronos?schema=public"
# GEMINI_API_KEY="your-gemini-api-key-here"

# 4. Generate Prisma client & apply database migrations
npm run db:generate
npx prisma db push

# 5. Seed institutional benchmark data
npm run db:seed

# 6. Run development servers (API & Web)
npm run dev:api   # Starts Express backend on http://localhost:4000
npm run dev:web   # Starts Vite React frontend on http://localhost:5173
```

---

## 🧪 Verification & Test Suites

The monorepo includes automated regression test suites covering all architectural layers:

```bash
# Monorepo typecheck across all 5 workspace packages
npm run typecheck

# Production build across all workspace packages
npm run build

# Deterministic solver metrics suite
npm run test:solver:metrics

# Generator CSP solver event stream suite
npm run test:csp

# Demo benchmark scenario suite
npm run test:demo

# Offline deterministic NL parser suite
npm run test:parser:deterministic

# Phase 1 workspace boundary isolation suite
npm run test:phase1

# Phase 3 browser visual & telemetry verification suite
npm run test:phase3

# Phase 4 deployment data-safety & seed isolation suite
npm run test:phase4
```

> [!NOTE]
> **Production Container Startup & Data Safety:**
> Production container execution (in `Dockerfile` and `apps/api/Dockerfile`) runs strictly `CMD ["npx", "tsx", "apps/api/src/index.ts"]`. Database schema migrations (`npx prisma db push`) and seed execution (`npm run db:seed`) are explicit, one-time setup steps. The seed script is scoped strictly to `xyz-institute-demo` and uses idempotent `upsert` calls for shared tables, preventing visitor sandbox data loss across container restarts.

---

## 📜 License

Built as an engineering portfolio project exploring Constraint Satisfaction Algorithms, deterministic search visualization, and LLM boundary scoping.

*All faculty names, emails, and staff IDs in the dataset are synthetic — only the structural course, room, and slot constraints reflect a real academic timetable.*
