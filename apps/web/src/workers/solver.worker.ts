import { solveCSP, SolverInput, SolverOptions, SolverStepEvent, SolverResult, SolverStats } from "@chronos/solver";

export type WorkerInMessage =
  | { type: "START"; problem: SolverInput; options?: SolverOptions; speed?: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STEP" }
  | { type: "SET_SPEED"; speed: number }
  | { type: "ABORT" };

export type WorkerOutMessage =
  | { type: "BATCH_EVENTS"; events: SolverStepEvent[]; metrics: SolverStats }
  | { type: "STATE_CHANGE"; state: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "UNSATISFIABLE" }
  | { type: "COMPLETED"; result: SolverResult; metrics: SolverStats }
  | { type: "UNSATISFIABLE"; metrics: SolverStats; reason?: string }
  | { type: "ERROR"; error: string };

let currentGenerator: Generator<SolverStepEvent, SolverResult, void> | null = null;
let isRunning = false;
let isPaused = false;
let playbackSpeed = 1; // 1 = normal, higher = faster, -1 = instant
let timerHandle: any = null;

let currentMetrics: SolverStats = {
  nodesExplored: 0,
  backtrackCount: 0,
  domainsPruned: 0,
  maxDepth: 0,
  timeMs: 0,
};

function postOut(msg: WorkerOutMessage) {
  self.postMessage(msg);
}

function processStep(): boolean {
  if (!currentGenerator) return false;

  try {
    const next = currentGenerator.next();

    if (next.done) {
      const finalResult = next.value as SolverResult;
      currentMetrics = finalResult.stats;
      isRunning = false;

      if (finalResult.success) {
        postOut({
          type: "COMPLETED",
          result: finalResult,
          metrics: currentMetrics,
        });
        postOut({ type: "STATE_CHANGE", state: "COMPLETED" });
      } else {
        postOut({
          type: "UNSATISFIABLE",
          metrics: currentMetrics,
          reason: finalResult.failureReason,
        });
        postOut({ type: "STATE_CHANGE", state: "UNSATISFIABLE" });
      }

      currentGenerator = null;
      return false; // Done
    }

    const event = next.value;
    if (event.type === "VARIABLE_SELECTED") {
      currentMetrics.nodesExplored++;
    } else if (event.type === "BACKTRACK") {
      currentMetrics.backtrackCount++;
    } else if (event.type === "DOMAIN_PRUNED") {
      currentMetrics.domainsPruned = (currentMetrics.domainsPruned || 0) + 1;
    }

    postOut({
      type: "BATCH_EVENTS",
      events: [event],
      metrics: { ...currentMetrics },
    });

    return true; // More steps available
  } catch (err: any) {
    isRunning = false;
    currentGenerator = null;
    postOut({ type: "ERROR", error: err?.message || String(err) });
    return false;
  }
}

function runLoop() {
  if (!isRunning || isPaused || !currentGenerator) return;

  if (playbackSpeed === -1) {
    // Instant mode: process in large chunks
    const batch: SolverStepEvent[] = [];
    let chunkCount = 0;

    while (chunkCount < 5000) {
      const next = currentGenerator.next();
      if (next.done) {
        const finalResult = next.value as SolverResult;
        currentMetrics = finalResult.stats;
        isRunning = false;

        if (batch.length > 0) {
          postOut({
            type: "BATCH_EVENTS",
            events: batch,
            metrics: { ...currentMetrics },
          });
        }

        if (finalResult.success) {
          postOut({
            type: "COMPLETED",
            result: finalResult,
            metrics: currentMetrics,
          });
          postOut({ type: "STATE_CHANGE", state: "COMPLETED" });
        } else {
          postOut({
            type: "UNSATISFIABLE",
            metrics: currentMetrics,
            reason: finalResult.failureReason,
          });
          postOut({ type: "STATE_CHANGE", state: "UNSATISFIABLE" });
        }

        currentGenerator = null;
        return;
      }

      batch.push(next.value);
      chunkCount++;
    }

    postOut({
      type: "BATCH_EVENTS",
      events: batch,
      metrics: { ...currentMetrics },
    });

    timerHandle = setTimeout(runLoop, 0);
  } else {
    // 60 FPS Paced playback: batch size calibrated for smooth real-time animation
    // speed 0.25 -> 5 events / 40ms (slow-motion examination)
    // speed 1 -> 25 events / 16ms (smooth 60 FPS live oscilloscope trace: ~1.2s total)
    // speed 5 -> 120 events / 16ms (~250ms total)
    // speed 20 -> 500 events / 16ms (~60ms total)
    const batchSize =
      playbackSpeed >= 20 ? 500 : playbackSpeed >= 5 ? 120 : playbackSpeed === 1 ? 25 : 5;
    const delay = playbackSpeed >= 20 ? 16 : playbackSpeed >= 5 ? 16 : playbackSpeed === 1 ? 16 : 40;

    const batch: SolverStepEvent[] = [];
    let hasMore = true;

    for (let i = 0; i < batchSize; i++) {
      if (!currentGenerator) {
        hasMore = false;
        break;
      }
      const next = currentGenerator.next();
      if (next.done) {
        const finalResult = next.value as SolverResult;
        currentMetrics = finalResult.stats;
        isRunning = false;

        if (batch.length > 0) {
          postOut({
            type: "BATCH_EVENTS",
            events: batch,
            metrics: { ...currentMetrics },
          });
        }

        if (finalResult.success) {
          postOut({
            type: "COMPLETED",
            result: finalResult,
            metrics: currentMetrics,
          });
          postOut({ type: "STATE_CHANGE", state: "COMPLETED" });
        } else {
          postOut({
            type: "UNSATISFIABLE",
            metrics: currentMetrics,
            reason: finalResult.failureReason,
          });
          postOut({ type: "STATE_CHANGE", state: "UNSATISFIABLE" });
        }

        currentGenerator = null;
        return;
      }

      const event = next.value;
      if (event.type === "VARIABLE_SELECTED") {
        currentMetrics.nodesExplored++;
      } else if (event.type === "BACKTRACK") {
        currentMetrics.backtrackCount++;
      } else if (event.type === "DOMAIN_PRUNED") {
        currentMetrics.domainsPruned = (currentMetrics.domainsPruned || 0) + 1;
      }
      batch.push(event);
    }

    if (batch.length > 0) {
      postOut({
        type: "BATCH_EVENTS",
        events: batch,
        metrics: { ...currentMetrics },
      });
    }

    if (hasMore && isRunning && !isPaused) {
      timerHandle = setTimeout(runLoop, delay);
    }
  }
}

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "START": {
      if (timerHandle) clearTimeout(timerHandle);
      playbackSpeed = msg.speed ?? 1;
      isPaused = false;
      isRunning = true;

      currentMetrics = {
        nodesExplored: 0,
        backtrackCount: 0,
        domainsPruned: 0,
        maxDepth: 0,
        timeMs: 0,
      };

      currentGenerator = solveCSP(msg.problem, msg.options);
      postOut({ type: "STATE_CHANGE", state: "RUNNING" });
      runLoop();
      break;
    }

    case "PAUSE": {
      isPaused = true;
      if (timerHandle) clearTimeout(timerHandle);
      postOut({ type: "STATE_CHANGE", state: "PAUSED" });
      break;
    }

    case "RESUME": {
      if (isRunning && isPaused) {
        isPaused = false;
        postOut({ type: "STATE_CHANGE", state: "RUNNING" });
        runLoop();
      }
      break;
    }

    case "STEP": {
      isPaused = true;
      if (timerHandle) clearTimeout(timerHandle);
      postOut({ type: "STATE_CHANGE", state: "PAUSED" });
      processStep();
      break;
    }

    case "SET_SPEED": {
      playbackSpeed = msg.speed;
      break;
    }

    case "ABORT": {
      isRunning = false;
      isPaused = false;
      if (timerHandle) clearTimeout(timerHandle);
      currentGenerator = null;
      postOut({ type: "STATE_CHANGE", state: "IDLE" });
      break;
    }
  }
};
