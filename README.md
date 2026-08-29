# CHRONOS
### Constraint-Based Timetable Scheduling Engine with Live Algorithm Visualization

`stack` **React · Express · PostgreSQL · Gemini** &nbsp;|&nbsp; `typecheck` **0 errors / 5 workspaces** &nbsp;|&nbsp; `nl-parser tests` **7/7 passing**

CHRONOS is a hand-written Constraint Satisfaction Problem (CSP) solver that generates conflict-free academic timetables — and lets you *watch it think*. It exposes the internal search process (backtracking, pruning, conflict resolution) as a live, animated search tree, and includes a natural-language interface for adding real-world scheduling constraints.

Built on a real dataset: the actual 5th-semester CSE timetable structure of a Computer Science program (11 courses, 12 faculty, 4 rooms, 2 divisions, 46 weekly sessions), with all personally identifiable information (names, emails, IDs) replaced with synthetic data.

---

## Why This Exists

Most "AI scheduling" demos are a thin prompt wrapped around an LLM that hallucinates a plausible-looking timetable. CHRONOS does the opposite: **the actual constraint solving is a deterministic, hand-written algorithm with zero external dependencies.** The LLM (Google Gemini) is used for exactly one thing — translating a sentence like *"Prof. Rathi is on leave Monday and Tuesday"* into a structured, database-validated constraint. It never touches the scheduling logic itself.

This split matters: the solver's correctness doesn't depend on an LLM not hallucinating a room number that doesn't exist.

---

## Why Not Just Ask an LLM?

A fair question: ChatGPT, Claude, or Gemini can already produce a timetable if you paste in the courses, faculty, and rooms. So why write a solver at all?

**Because an LLM can't guarantee correctness — it can only guarantee plausibility.** Ask an LLM to schedule 46 sessions across 12 faculty, 4 rooms, and 6 days, and it will produce something that *looks* like a valid timetable. It has no mechanism to formally verify that no faculty member is double-booked, no room is double-booked, and every hard constraint holds simultaneously across all 46 assignments — it's pattern-matching against what a timetable typically looks like, not proving correctness. At this project's scale, verifying that by hand is tedious. At real-institution scale (hundreds of courses), it's practically impossible to eyeball, and an LLM's context window and consistency degrade well before then.

This project's own benchmark data makes the point concretely: an **unguided search** (the "Chronological / Naive" mode — evaluate options in whatever order they come, no lookahead) is a reasonable proxy for how an LLM would approach the same problem — no systematic strategy for which choice to make first, no formal backtracking guarantee. On this dataset, that approach hits a bounded search limit after **2,328 failed attempts and still doesn't find a solution.** The MRV+LCV-guided solver finds a fully valid one in **46 steps, zero mistakes.**

A CSP solver is deterministic: if a solution exists, it is guaranteed to find one (given enough search budget), and if none exists, it can say so with confidence — not "here's my best guess." An LLM offers neither guarantee. That's the actual case for writing this instead of prompting a chatbot.

Gemini is still used in this project — deliberately, for exactly the one job LLMs are well-suited for: turning a loosely-worded sentence into a structured, database-validated rule. It never touches the scheduling logic itself.

---

## The Core Demo: Naive vs. Smart Search

The most direct way to see what CHRONOS actually does is to load the **"Naive vs Smart Bottleneck Demo"** scenario and run it in both search modes:

| Mode | Result | Nodes Explored | Backtracks | Time |
|---|---|---|---|---|
| **Chronological (naive ordering)** | Bounded search limit reached — no solution found | 2,328 | 2,328 | ~1.2s (browser) |
| **MRV + LCV (smart heuristics)** | Solved — 0 constraint violations | 46 | 0 | ~45ms |

Same problem. Same 46 required sessions. Same hard constraints (two faculty on partial leave, a blocked time slot, a daily course-repeat limit). The only difference is *which variable the solver picks next* when it has a choice.

**Why the naive version fails:** without a heuristic, the solver assigns easy, unconstrained courses first (electives, single-faculty subjects) and greedily fills the best morning slots. By the time it reaches the two bottleneck courses — both taught by faculty with limited availability — every viable slot for them is already taken by something that didn't need to go there. It backtracks thousands of times trying to undo earlier choices, and still doesn't find a way out within a bounded search.

**Why the smart version succeeds instantly:** Minimum-Remaining-Values (MRV) ordering forces the solver to schedule the *most constrained* variables first — the two bottleneck courses get placed at step 1, while their few legal options still exist. Everything else, which has much more flexibility, fits in afterward without conflict. Forward checking prunes invalid domains as it goes, so there's nothing left to backtrack from.

This isn't a scripted animation — it's the same solver, same input, running two different search strategies.

---

## Architecture

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

## Tech Stack

- **Frontend:** React 18, TypeScript (strict), Vite, D3.js (search tree), GSAP (animation pacing)
- **Backend:** Node.js, Express, TypeScript (strict)
- **Database:** PostgreSQL, Prisma ORM
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

---

## What's Not in Scope (Yet)

- Soft-constraint optimization (preferences are parsed and stored but not yet weighted into the objective function)
- Multi-institution / multi-semester scheduling
- A second search strategy beyond backtracking (e.g., simulated annealing) for very large instances

---

*Built as a portfolio project to explore constraint satisfaction algorithms in a domain with genuine, hard-to-fake complexity. All faculty names, emails, and IDs in the seed data are synthetic — only the subject/timing/room structure reflects a real academic timetable.*
