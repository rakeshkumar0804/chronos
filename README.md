# CHRONOS
### Constraint-Based Timetable Scheduling Engine with Live Algorithm Visualization

![stack](https://img.shields.io/badge/stack-React_%7C_Express_%7C_PostgreSQL_%7C_Gemini-blue) ![typecheck](https://img.shields.io/badge/typecheck-0_errors_%2F_5_workspaces-brightgreen) ![nl--parser tests](https://img.shields.io/badge/nl--parser_tests-7%2F7_passing-brightgreen)

CHRONOS is a hand-written Constraint Satisfaction Problem (CSP) solver that generates conflict-free academic timetables — and lets you *watch it think*. It exposes the internal search process (backtracking, pruning, conflict resolution) as a live, animated search tree, and includes a natural-language interface for adding real-world scheduling constraints.

Built on a real dataset: the actual 5th-semester CSE timetable structure of a Computer Science program (11 courses, 12 faculty, 4 rooms, 2 divisions, 46 weekly sessions), with all personally identifiable information (names, emails, IDs) replaced with synthetic data.

---

## 🔴 Live Demo

**[chronos-web-kappa.vercel.app](https://chronos-web-kappa.vercel.app)**

Try it yourself — no setup required:
1. Click **"Naive vs Smart Bottleneck Demo"** to load the benchmark scenario
2. Run it in **Chronological (Naive)** mode — watch it hit a bounded search limit after thousands of failed backtracks
3. Switch to **MRV + LCV (Smart)** and re-run — watch it solve the identical problem in 46 steps with zero mistakes
4. Try typing a constraint in plain English in the **NL Constraint Injector** panel (e.g. *"Room 132 is closed on Friday morning for maintenance"*) and watch it get parsed and validated live

*(First backend request may take a few seconds to respond — it's hosted on a free-tier server that sleeps after inactivity.)*

---

## Why This Exists

Most "AI scheduling" demos are a thin prompt wrapped around an LLM that hallucinates a plausible-looking timetable. CHRONOS does the opposite: **the actual constraint solving is a deterministic, hand-written algorithm with zero external dependencies.** The LLM (Google Gemini) is used for exactly one thing — translating a sentence like *"Prof. Rathi is on leave Monday and Tuesday"* into a structured, database-validated constraint. It never touches the scheduling logic itself.

This split matters: the solver's correctness doesn't depend on an LLM not hallucinating a room number that doesn't exist.

---

## Why Not Just Ask an LLM?

A fair question: ChatGPT, Claude, or Gemini can already produce a timetable if you paste in the courses, faculty, and rooms. So why write a solver at all?

**Because an LLM can't guarantee correctness — it can only guarantee plausibility.** Ask an LLM to schedule 46 sessions across 12 faculty, 4 rooms, and 6 days, and it will produce something that *looks* like a valid timetable. It has no mechanism to formally verify that no faculty member is double-booked, no room is double-booked, and every hard constraint holds simultaneously across all 46 assignments — it's pattern-matching against what a timetable typically looks like, not proving correctness. At this project's scale, verifying that by hand is tedious. At real-institution scale (hundreds of courses), it's practically impossible to eyeball, and an LLM's context window and consistency degrade well before then.

This project's benchmark compares an unguided search strategy (Chronological mode — evaluates variables in a fixed sequence without constraint-aware lookahead) against CHRONOS's guided strategy (MRV + LCV with forward checking). On this dataset, the unguided chronological search does not find a solution even when given an offline budget of 10,000,000 backtracks (historical recorded run: ~98.4s, 10,001,246 nodes explored). The MRV+LCV-guided solver finds a fully valid solution in 46 search tree nodes with zero backtracks.

A CSP solver is deterministic: if a solution exists, it is guaranteed to find one (given enough search budget), and if none exists, it can say so with confidence — not "here's my best guess." An LLM offers neither guarantee. That's the actual case for writing this instead of prompting a chatbot.

Gemini is still used in this project — deliberately, for exactly the one job LLMs are well-suited for: turning a loosely-worded sentence into a structured, database-validated rule. It never touches the scheduling logic itself.

---

## Metric Definitions

CHRONOS tracks precise, hardware-independent solver counters for every execution run:

- **Nodes Explored (`nodesExplored` / `VALUE_TRIED`):** Total candidate assignment attempts evaluated during search.
- **Backtracks (`backtrackCount` / `BACKTRACK`):** Total decision points where the solver was forced to undo a tentative assignment after encountering a domain wipeout or hard constraint collision.

---

## The Core Demo: Naive vs. Smart Search

The most direct way to see CHRONOS in action is to load the **"Naive vs Smart Bottleneck Demo"** scenario in the live interactive UI:

### Live Interactive Browser Demo Metrics (`maxBacktracks = 1,000`)

| Strategy | Result | Nodes Explored | Backtracks | Execution Time |
|---|---|---|---|---|
| **Chronological (Unguided Naive)** | Bounded Search Limit Hit (`HIT_CAP`: 1,000 max backtracks reached) | **1,046** | **1,000** | **~1.6 ms** |
| **MRV + LCV (Constraint-Guided Smart)** | Solved (`NATURALLY_CONVERGED_SOLVED`: 0 violations) | **46** | **0** | **~1.2 ms** |

*(In the live browser UI, Naive Chronological mode is configured with a responsive search budget of `maxBacktracks = 1000`. Once 1,000 backtracks are unwound, the search halts immediately and returns `HIT_CAP`.)*

### Historical Uncapped Benchmark Evidence (August 2026 Offline Run)

| Strategy | Result | Nodes Explored | Backtracks | Machine Execution Time |
|---|---|---|---|---|
| **Chronological (Unguided Naive Uncapped)** | Bounded Search Limit Hit (`HIT_CAP`: 10,000,000 max backtracks limit) | 10,001,246 | 10,001,246 | ~98.4s *(machine-specific historical benchmark)* |
| **MRV + LCV (Constraint-Guided Smart)** | Solved (`NATURALLY_CONVERGED_SOLVED`: 0 violations) | 46 | 0 | ~75ms *(machine-specific)* |

*(The historical uncapped run demonstrates that unguided chronological search fails to converge on this bottleneck dataset even when granted an offline budget of 10 million backtracks.)*

Same problem. Same 46 required sessions. Same hard constraints (two faculty on partial leave, a blocked time slot, a daily course-repeat limit). The only difference is *which variable the solver picks next* when it has a choice.

**Why the naive version fails:** without a heuristic, the solver assigns easy, unconstrained courses first (electives, single-faculty subjects) and greedily fills the best morning slots. By the time it reaches the two bottleneck courses — both taught by faculty with limited availability — every viable slot for them is already taken by something that didn't need to go there. It backtracks repeatedly trying to undo earlier choices, and still doesn't find a way out even with a **10-million-backtrack budget.**

**Why the smart version succeeds instantly:** Minimum-Remaining-Values (MRV) ordering forces the solver to schedule the *most constrained* variables first — the two bottleneck courses get placed at step 1, while their few legal options still exist. Everything else, which has much more flexibility, fits in afterward without conflict. Forward checking prunes invalid domains as it goes, so there's nothing left to backtrack from.

This isn't a scripted animation — it's the same solver, same input, running two different search strategies.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      apps/web (React 18 + TS)           │
│   Search Tree Visualizer (D3) · Live Timetable Matrix   │
│   NL Constraint Studio · Web Worker (off-main-thread solve)│
└───────────────────────────┬─────────────────────────────┘
                             │ REST
┌───────────────────────────▼─────────────────────────────┐
│                    apps/api (Express + TS)              │
│         /api/solve  ·  /api/constraints/parse           │
└─────────┬─────────────────────────────────┬─────────────┘
          │                                 │
┌─────────▼────────────┐       ┌────────────▼─────────────┐
│    packages/solver   │       │    packages/nl-parser    │
│    Hand-written CSP  │       │  Gemini structured output│
│  backtracking engine │       │  + DB-backed validation  │
│  (zero dependencies) │       │  (rejects hallucinations)│
└─────────┬────────────┘       └────────────┬─────────────┘
          │                                 │
          └───────────────┬─────────────────┘
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │ (Prisma ORM)│
                    └─────────────┘
```

**Monorepo packages:**
- `packages/shared` — TypeScript types shared across the stack, kept in sync with the Prisma schema
- `packages/solver` — the CSP engine (see below)
- `packages/nl-parser` — natural language → structured constraint pipeline
- `apps/api` — Express backend, database access via Prisma
- `apps/web` — React frontend, D3.js search tree, GSAP-driven animation pacing

---

## The Solver

The scheduling problem is formulated as a classic CSP:

- **Variables:** one per (course, division, session-instance) — e.g., "DAA session 2 for division 5A15-1" — 46 in total for the seeded dataset
- **Domains:** every legal (time slot, room, faculty) combination for that variable, filtered by room type (lab vs. lecture), faculty qualification, and non-break time slots
- **Hard constraints:** no faculty double-booked, no room double-booked, no division double-booked, no sessions in break slots, lab courses only in lab rooms, faculty must be assigned to that course

**Search strategy:**
- **Minimum Remaining Values (MRV):** always branch on the variable with the fewest legal options left
- **Least Constraining Value (LCV):** among legal values, try the one that eliminates the fewest options for other variables first
- **Forward checking:** after every assignment, prune now-invalid values from the domains of unassigned variables, so conflicts are caught before a full search-space is wasted on them
- **Deterministic tie-breaking:** when multiple variables/values are equally good by MRV/LCV, ties are broken by a stable sort (course code, faculty short code, etc.) — this was added after discovering that unsorted iteration order produced different backtrack counts across runs of the *same* scenario

Every run tracks real, measured statistics (`nodesExplored`, `backtrackCount`, `timeMs`) — none of these are estimated or hardcoded. A full step-by-step trace (`assign` / `conflict` / `backtrack` events) is captured and powers the live visualization.

### An honest note on the naive/smart contrast

Calibrating a scenario that was both *genuinely hard* and *solvable* took real trial and error. With MRV+LCV active, this dataset's problems tend to be either trivially easy (0 backtracks) or genuinely infeasible within a bounded search — there wasn't a stable "moderate difficulty" middle ground to land on with the heuristic active. The demo scenario instead uses a fixed, deliberately naive processing order for the chronological mode (schedule unconstrained electives first, as an unassisted scheduler naturally would) contrasted against MRV+LCV on the identical constraint set. This is a fair comparison — it reflects how a genuinely naive scheduler behaves — but it's worth being transparent that the ordering for "naive" mode is fixed rather than arbitrary, for exactly this reason.

The solver also correctly distinguishes "no solution found within the search limit" from "provably impossible" — it does not claim to exhaustively prove infeasibility, only that it exhausted its configured search budget without success.

---

## Natural Language Constraints

Typing something like:

> "Room 132 is undergoing maintenance on Friday morning"

...is parsed by Gemini using strict JSON schema output (not free-form text) into a structured constraint:

```json
{
  "category": "ROOM_UNAVAILABLE",
  "type": "HARD",
  "structuredRule": { "roomNo": "132", "days": ["FRI"], "startTimes": ["07:30", "08:30", "09:45"] }
}
```

Before this constraint is accepted, it's validated against the real database — if the input references a faculty member, room, or course that doesn't exist (e.g., a hallucinated name the model invented), it's rejected with a clear error rather than silently applied. Ambiguous or non-actionable input ("the weather is nice today") is also explicitly rejected rather than guessed at.

---

## Quick Add: Feeding It Different Data

The solver isn't hardcoded to this one dataset — it reads whatever Courses, Faculty, and Rooms exist in the database and solves for that. A **Quick Add** panel lets new entities be added directly from the UI into a client-partitioned **Visitor Sandbox**:

- Add a single Faculty, Room, or Course (with multi-select for co-teaching — several courses in the seeded dataset, like the lab sections, are already taught by two instructors, so this had to be supported from the start)
- **Visitor Sandbox Partitioning (Trust Boundary):** Injected entities are partitioned using an unauthenticated visitor workspace ID (`ws-<uuid>`) stored in `localStorage`. This partition prevents accidental UI collisions between anonymous visitors, but is explicitly NOT an authorization or privacy boundary: any caller who knows a workspace ID can query or mutate that sandbox. The official XYZ Institute benchmark dataset (`xyz-institute-demo`) is protected by database/Prisma middleware guards against public mutation or reset.
- A **Reset to Benchmark Data** action clears custom entities belonging to the visitor's sandbox, leaving the official 46-session institutional dataset and other visitor sessions intact.

This means the demo isn't limited to the one seeded timetable — new courses, faculty, or rooms typed in live get picked up by the same solver, same heuristics, no code changes required.

---

## Tech Stack

- **Frontend:** React 18, TypeScript (strict), Vite, D3.js (search tree), GSAP (animation pacing) — deployed on Vercel
- **Backend:** Node.js, Express, TypeScript (strict) — deployed on Render
- **Database:** PostgreSQL, Prisma ORM — hosted on Neon (serverless Postgres)
- **AI:** Google Gemini (structured output / JSON schema mode) — used exclusively for natural language constraint parsing, never for scheduling logic
- **Solver:** hand-written TypeScript, zero external CSP/optimization libraries

---

## Running Locally

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed

# .env — see .env.example
GEMINI_API_KEY=your_key_here   # free tier at aistudio.google.com

npm run dev
```

> [!NOTE]
> **Production Deployment & Data Safety:**
> Container startup (in Dockerfile and `apps/api/Dockerfile`) is strictly non-destructive (`CMD ["npx", "tsx", "apps/api/src/index.ts"]`). Database migrations (`npx prisma db push`) and initial benchmark seeding (`npm run db:seed`) are explicit, one-time deployment steps. Seeding is scoped strictly to the institutional benchmark (`xyz-institute-demo`) and upserts shared records, ensuring visitor sandbox data is preserved across container restarts.

---

## What's Not in Scope (Yet)

- Authenticated user accounts & persistent cross-device management (the workspace feature is an unauthenticated client-partitioned visitor sandbox; authenticated multi-tenant accounts with cross-device sync are out of scope)
- Soft-constraint optimization (preferences are parsed and stored but not yet weighted into the objective function — the solver currently optimizes for feasibility, not for things like spreading sessions evenly across the week)
- A second search strategy beyond backtracking (e.g., simulated annealing) for much larger instances

---

*Built as a portfolio project to explore constraint satisfaction algorithms in a domain with genuine, hard-to-fake complexity. All faculty names, emails, and IDs in the seed data are synthetic — only the subject/timing/room structure reflects a real academic timetable.*
