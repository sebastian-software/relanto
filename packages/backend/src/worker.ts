import { closeDatabase } from "./db.js";
import { getRetentionIntervalMs, getShutdownTimeoutMs, getWorkerIntervalMs } from "./env.js";
import { processDueJobs, reclaimStuckProcessingJobs, runRetention } from "./service.js";

let started = false;
let tickInFlight = false;
let retentionInFlight = false;
let shuttingDown = false;
let timer: NodeJS.Timeout | undefined;
let retentionTimer: NodeJS.Timeout | undefined;
let lastTickAt: number | undefined;
let currentTick: Promise<unknown> | undefined;
let signalHandlersRegistered = false;

function tickWorker(): void {
  if (tickInFlight || shuttingDown) {
    return;
  }

  tickInFlight = true;

  currentTick = processDueJobs()
    .catch((error: unknown) => {
      console.error("[mailer-worker]", error);
    })
    .finally(() => {
      tickInFlight = false;
      lastTickAt = Date.now();
      currentTick = undefined;
    });
}

function tickRetention(): void {
  if (retentionInFlight) {
    return;
  }

  retentionInFlight = true;

  try {
    runRetention();
  } catch (error: unknown) {
    console.error("[mailer-retention]", error);
  } finally {
    retentionInFlight = false;
  }
}

function handleTerminationSignal(): void {
  void shutdownWorker();
}

function registerShutdownHandlers(): void {
  if (signalHandlersRegistered) {
    return;
  }

  signalHandlersRegistered = true;
  process.on("SIGTERM", handleTerminationSignal);
  process.on("SIGINT", handleTerminationSignal);
}

function unregisterShutdownHandlers(): void {
  if (!signalHandlersRegistered) {
    return;
  }

  signalHandlersRegistered = false;
  process.off("SIGTERM", handleTerminationSignal);
  process.off("SIGINT", handleTerminationSignal);
}

function reclaimStuckJobsOnStartup(): void {
  // Single-instance mailer (SQLite, one worker): any job still marked as
  // `processing` on boot was orphaned by a previous crash or hard shutdown
  // between claim and final status update. Reclaim it before we accept ticks.
  try {
    const reclaimed = reclaimStuckProcessingJobs();

    if (reclaimed > 0) {
      console.warn(
        `[mailer-worker] reclaimed ${String(reclaimed)} stuck processing job(s) on startup`,
      );
    }
  } catch (error: unknown) {
    console.error("[mailer-worker] startup reclaim failed", error);
  }
}

/**
 * Starts the in-process mailer worker loop.
 *
 * On the first call, reclaims any jobs orphaned in `processing` status by a
 * previous crash, then schedules a mail-processing tick and a retention sweep at
 * the configured intervals. Both timers are `unref`'d so they do not prevent a
 * natural process exit when no other work is pending.
 *
 * Idempotent: subsequent calls while the loop is already running are no-ops.
 */
export function startWorkerLoop(): void {
  if (started) {
    return;
  }

  started = true;
  shuttingDown = false;

  reclaimStuckJobsOnStartup();
  registerShutdownHandlers();

  tickWorker();
  tickRetention();
  timer = setInterval(tickWorker, getWorkerIntervalMs());
  timer.unref();
  retentionTimer = setInterval(tickRetention, getRetentionIntervalMs());
  retentionTimer.unref();
}

/**
 * Resolves when the currently in-flight processing tick completes, or after
 * `timeoutMs` milliseconds — whichever comes first.
 *
 * Called by {@link shutdownWorker} to drain in-progress work before the database
 * connection is closed. Safe to call when no tick is in flight; resolves immediately.
 *
 * @param timeoutMs - Maximum time to wait in milliseconds. Defaults to the configured shutdown timeout.
 */
export async function waitForCurrentTick(timeoutMs = getShutdownTimeoutMs()): Promise<void> {
  const tick = currentTick;

  if (!tick) {
    return;
  }

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutHandle = setTimeout(resolve, timeoutMs);
    timeoutHandle.unref();
  });

  try {
    await Promise.race([tick, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Initiates a graceful shutdown of the in-process worker.
 *
 * Stops the interval timers, drains the current in-flight tick (up to the
 * configured or provided timeout), closes the SQLite database, and by default
 * terminates the process with exit code 0. Pass `exit: false` in tests or
 * embedding contexts where process termination is undesirable.
 *
 * @param options - Overrides for exit behaviour and drain timeout.
 * @param options.exit - When `true` (the default), `process.exit(0)` is called
 *   after shutdown; pass `false` in tests or embedding contexts.
 * @param options.timeoutMs - Overrides the configured drain wait.
 */
export async function shutdownWorker(
  options: { exit?: boolean; timeoutMs?: number } = {},
): Promise<void> {
  const { exit = true, timeoutMs } = options;

  // Stop accepting new ticks immediately, even if a tick is still in flight.
  shuttingDown = true;
  started = false;

  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }

  await waitForCurrentTick(timeoutMs);

  closeDatabase();

  if (exit) {
    // Deliberate: a graceful shutdown has drained the worker and closed the
    // database, so exiting the process is the intended terminal step here.
    // eslint-disable-next-line node/no-process-exit -- intentional clean exit after graceful drain
    process.exit(0);
  }
}

/**
 * Returns the epoch-millisecond timestamp of the last completed processing tick.
 *
 * Useful for health checks that verify the worker is making progress. Returns
 * `undefined` if no tick has finished since the loop was last started.
 *
 * @returns Epoch milliseconds of the last completed tick, or `undefined`.
 */
export function getLastTickAt(): number | undefined {
  return lastTickAt;
}

/**
 * Stops the worker loop timers and resets all internal module state without
 * terminating the process or closing the database.
 *
 * Unlike {@link shutdownWorker}, this function does not drain an in-flight tick
 * and does not call `closeDatabase`. Intended for use in test teardown.
 */
export function stopWorkerLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }

  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = undefined;
  }

  unregisterShutdownHandlers();
  started = false;
  tickInFlight = false;
  retentionInFlight = false;
  shuttingDown = false;
  currentTick = undefined;
}
