# CHRONOS — Constraint-Based Timetable Scheduling Engine with Live Algorithm Visualization

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)
![D3.js](https://img.shields.io/badge/D3.js-7.9-F9A03C?style=flat-square&logo=d3.js)
![Google Gemini](https://img.shields.io/badge/Gemini_API-3.6_Flash-4285F4?style=flat-square&logo=google)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**A deterministic, zero-dependency Constraint Satisfaction Problem (CSP) backtracking solver engine paired with an interactive 60 FPS D3.js visualizer and natural language constraint grounding via Google Gemini.**

</div>

---

## 📖 Overview

**CHRONOS** is a hand-written Constraint Satisfaction Problem (CSP) solver that generates conflict-free academic timetables — and lets you watch it think. It exposes the internal search process (backtracking, forward checking pruning, and conflict resolution) as a live, animated search tree, and includes a natural-language interface for adding real-world scheduling constraints.

**Built on a real dataset:** The actual 5th-semester CSE timetable structure of an engineering college (11 courses, 12 faculty, 4 rooms, 2 divisions, 46 weekly sessions), with all personally identifiable information (names, emails, IDs) replaced with synthetic data.

---

## 🏛️ Why This Exists (Anti-Wrapper Architecture)

Most "AI scheduling" demos are a thin prompt wrapped around an LLM that hallucinates a plausible-looking timetable. **CHRONOS does the opposite:**

1. **The actual constraint solving is a deterministic, hand-written algorithm with zero external dependencies.** No black-box external solvers (no OR-Tools, no third-party libraries).
2. **The LLM (Google Gemini) is used for exactly one thing:** translating a sentence like *"Prof. Karan Rathi is on leave Monday and Tuesday"* into a structured, database-validated constraint. It never touches the scheduling logic itself.

> **This split matters:** The solver's correctness does not depend on an LLM not hallucinating a room number that doesn't exist.

---

## 🔬 The Core Demo: Naive vs. Smart Search

The most direct way to see what CHRONOS actually does is to load the **"Naive vs Smart Bottleneck Demo"** scenario and run it in both search modes:

| Mode | Result | Nodes Explored | Backtracks | Time |
| :--- | :--- | :---: | :---: | :---: |
| **Chronological (naive ordering)** | Bounded search limit reached — no solution found | 2,328 | 2,256 | ~1.2s (browser) / ~35ms (Instant) |
| **MRV + LCV (smart heuristics)** | Solved — 0 constraint violations | 46 | 0 | ~45ms |

*Same problem. Same 46 required sessions. Same hard constraints (two faculty on partial leave, a blocked time slot, a daily course-repeat limit). The only difference is which variable the solver picks next when it has a choice.*

* **Why the naive version fails:** Without a heuristic, the solver assigns easy, unconstrained courses first (electives, single-faculty subjects) and greedily fills the best morning slots. By the time it reaches the two bottleneck courses — both taught by faculty with limited availability — every viable slot for them is already taken by something that didn't need to go there. It backtracks thousands of times trying to undo earlier choices, and still cannot find a way out within a bounded search.
* **Why the smart version succeeds instantly:** Minimum Remaining Values (MRV) ordering forces the solver to schedule the most constrained variables first — the two bottleneck courses get placed at step 1, while their few legal options still exist. Everything else, which has much more flexibility, fits in afterward without conflict. Forward checking prunes invalid domains as it goes, so there's nothing left to backtrack from.

*This isn't a scripted animation — it's the exact same solver, same input, running two different search strategies.*

---

## 📐 Formal Mathematical CSP Formulation

The scheduling problem is formulated as a classic CSP triple $\langle X, D, C \rangle$:

### 1. Variables ($X$)
For each division $d \in \mathcal{D}$ and course $c \in \mathcal{C}$ requiring $w_c$ weekly hours:
$$X = \{ x_{d, c, s} \mid d \in \mathcal{D}, c \in \mathcal{C}, s \in \{1, 2, \dots, w_c\} \}$$
Total variable count for XYZ Institute baseline = **46 session units** ($2$ divisions $\times$ $23$ hours).

### 2. Domains ($D$)
Each variable $x_{d, c, s}$ takes a value from the domain of legal triples:
$$D(x_{d, c, s}) \subseteq \mathcal{T} \times \mathcal{R} \times \mathcal{F}$$
filtered by room type (lab vs. lecture), faculty qualification, and non-break time slots.

### 3. Hard Constraints ($C_{\text{hard}}$)
1. **No Faculty Double-Booking:**
   $$\forall i \neq j, \quad \text{time}(x_i) = \text{time}(x_j) \implies \text{faculty}(x_i) \neq \text{faculty}(x_j)$$
2. **No Room Collision:**
   $$\forall i \neq j, \quad \text{time}(x_i) = \text{time}(x_j) \implies \text{room}(x_i) \neq \text{room}(x_j)$$
3. **No Student Division Overlap:**
   $$\forall i \neq j, \quad \text{division}(x_i) = \text{division}(x_j) \implies \text{time}(x_i) \neq \text{time}(x_j)$$
4. **Room Type Compatibility:**
   $$\text{type}(c) = \text{LAB} \implies \text{type}(\text{room}(x)) = \text{LAB}, \quad \text{type}(c) = \text{LECTURE} \implies \text{type}(\text{room}(x)) = \text{LECTURE\_ROOM}$$
5. **Daily Course Lecture Limit:**
   $$\forall d \in \mathcal{D}, c \in \mathcal{C}, t \in \text{Days}, \quad \sum_{s=1}^{w_c} \mathbb{I}(\text{day}(x_{d, c, s}) = t) \le L_{d, c}$$
6. **Explicit Unavailability Masks:**
   $$\text{faculty}(x) = f \implies \text{time}(x) \notin U_{\text{faculty}}(f), \quad \text{room}(x) = r \implies \text{time}(x) \notin U_{\text{room}}(r)$$

### 4. Search Strategy & Propagation
* **Minimum Remaining Values (MRV):** Always branch on the variable with the fewest legal options left:
  $$x^* = \arg\min_{x \in X_{\text{unassigned}}} |D(x)|$$
* **Degree Heuristic Tie-Breaker:** When domain sizes tie, pick the variable with the most unassigned graph neighbors:
  $$x^* = \arg\max_{x} \text{deg}(x)$$
* **Least Constraining Value (LCV):** Among legal values, try the one that eliminates the fewest options for other variables:
  $$v^* = \arg\min_{v \in D(x)} \sum_{y \in \text{Neighbors}(x)} \text{PrunedCount}(D(y), v)$$
* **Forward Checking (AC-3):** After every assignment, prune now-invalid values from domains of unassigned variables. If any domain wipes out ($D(y) = \emptyset$), trigger backtrack immediately.
* **Deterministic Tie-Breaking:** When multiple variables/values have equal priority, ties are broken by stable sorting (course code, faculty short code, room number).

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      apps/web (React 18 + TS)             │
│   Search Tree Visualizer (D3) · Live Timetable Matrix     │
│   NL Constraint Studio · Web Worker (off-main-thread solve)│
└───────────────────────────┬────────────────────────────┘
                             │ REST
┌───────────────────────────▼────────────────────────────┐
│                    apps/api (Express + TS)                 │
│         /api/solve  ·  /api/constraints/parse              │
└─────────┬─────────────────────────────────┬───────────────┘
          │                                 │
┌─────────▼────────────┐       ┌────────────▼─────────────┐
│  packages/solver       │       │  packages/nl-parser        │
│  Hand-written CSP       │       │  Gemini structured output   │
│  backtracking engine    │       │  + DB-backed validation     │
│  (zero dependencies)    │       │  (rejects hallucinations)   │
└─────────┬────────────┘       └────────────┬─────────────┘
          │                                 │
          └───────────────┬─────────────────┘
                    ┌──────▼──────┐
                    │  PostgreSQL   │
                    │  (Prisma ORM) │
                    └───────────────┘
```

### Monorepo Packages:
* **`packages/shared`** — TypeScript types shared across the stack, kept in sync with the Prisma schema.
* **`packages/solver`** — The pure CSP engine (`solve` and `solveCSP` generator).
* **`packages/nl-parser`** — Natural language $\rightarrow$ structured constraint pipeline with Gemini.
* **`apps/api`** — Express backend, database access via Prisma.
* **`apps/web`** — React frontend, D3.js search tree, Web Worker generator pipeline.

---

## 🔍 An Honest Note on the Naive vs. Smart Contrast

Calibrating a scenario that was both genuinely hard and solvable took real trial and error. With MRV+LCV active, this dataset's problems tend to be either trivially easy (0 backtracks) or genuinely infeasible within a bounded search — there was no stable "moderate difficulty" middle ground to land on with the heuristic active.

The demo scenario instead uses a fixed, deliberately naive processing order for the chronological mode (schedule unconstrained electives first, as an unassisted scheduler naturally would) contrasted against MRV+LCV on the identical constraint set. This is a fair comparison — it reflects how a genuinely naive scheduler behaves — but it's worth being transparent that the ordering for "naive" mode is fixed rather than arbitrary, for exactly this reason.

The solver also correctly distinguishes *"no solution found within the search limit"* from *"provably impossible"* — it does not claim to exhaustively prove infeasibility, only that it exhausted its configured search budget without success.

---

## 💬 Natural Language Constraints

Typing something like:

> *"Room 132 is undergoing maintenance on Friday morning"*

...is parsed by Gemini using native JSON structured output (not free-form prose) into a typed schema:

```json
{
  "category": "ROOM_UNAVAILABLE",
  "type": "HARD",
  "structuredRule": {
    "roomNo": "132",
    "days": ["FRI"],
    "startTimes": ["07:30", "08:30", "09:45"]
  }
}
```

Before this constraint is accepted, it is validated against the real PostgreSQL database — if the input references a faculty member, room, or course that does not exist (e.g., a hallucinated name the model invented), it is rejected with a clear error rather than silently applied. Ambiguous or non-actionable input (*"the weather is nice today"*) is also explicitly rejected.

---

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript (strict), Vite, D3.js (search tree), Lucide Icons, Canvas Confetti
* **Backend:** Node.js, Express, TypeScript (strict)
* **Database:** PostgreSQL, Prisma ORM
* **AI:** Google Gemini 3.6 Flash (structured output / JSON schema mode) — used exclusively for natural language constraint parsing, never for scheduling logic
* **Solver:** Hand-written TypeScript, zero external CSP / optimization libraries

---

## 🚀 Running Locally

### 1. Prerequisites
* **Node.js**: `v20.x` or higher
* **PostgreSQL**: Local running instance or cloud database
* **Google Gemini API Key**: Free tier at [Google AI Studio](https://aistudio.google.com/)

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/your-username/chronos.git
cd chronos

# Install monorepo dependencies
npm install

# Setup environment variables (.env)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chronos?schema=public"
PORT=4000
GEMINI_API_KEY="your_api_key_here"
GEMINI_MODEL="gemini-3.6-flash"

# Initialize database & seed institutional data
npx prisma generate
npx prisma db push
npm run db:seed
```

### 3. Launch Application
```bash
# Terminal 1: Backend API Server (Port 4000)
npm run dev:api

# Terminal 2: Web Visualizer Studio (Port 3000)
npm run dev:web
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Comprehensive Test Suites

```bash
# 1. Run CSP Generator Solver Test Suite (4/4 tests)
npm run test:csp

# 2. Run 120-Session Multi-Division Scale Stress Benchmark
npm run test:stress

# 3. Run Live Google Gemini Constraint Parser Test Suite (7/7 tests)
npm run test:live

# 4. Run Baseline Synchronous Solver Test
npm run test:solver

# 5. Strict TypeScript Typecheck Across All 5 Workspaces
npm run typecheck
```

---

## 🚢 Cloud Deployment

* **Backend (Render / Railway):** Multi-stage production container via [`apps/api/Dockerfile`](apps/api/Dockerfile) and [`render.yaml`](render.yaml) / [`railway.json`](railway.json).
* **Frontend (Vercel):** SPA build configuration with Web Worker MIME headers via [`apps/web/vercel.json`](apps/web/vercel.json).

---

## 📄 License
MIT License © 2026 CHRONOS Team.
