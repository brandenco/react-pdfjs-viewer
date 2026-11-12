/**
 * Helpers for long-running loops (page-size loading, search) to hand control back to
 * the browser regularly, so they never block input or rendering.
 */
import { runtime } from "./runtime.ts";

type Priority = "user-visible" | "background";

/** Work running longer than this without a break counts as a "long task". */
const TASK_BUDGET_MS = 50;

/**
 * Lets the browser handle input and paint before continuing.
 *
 * - `user-visible`: `scheduler.yield()`, which resumes ahead of other queued work.
 * - `background`: a background-priority task, so it never competes with rendering.
 *
 * Falls back to `setTimeout` where the Scheduler API is missing (Safari).
 */
export function yieldToMain(priority: Priority = "user-visible"): Promise<void> {
  const { scheduler } = runtime;
  if (priority === "background" && scheduler?.postTask) {
    return scheduler.postTask(() => {}, { priority: "background" });
  }
  if (scheduler?.yield) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Returns a `maybeYield()` function to call inside a loop. It only yields once the loop
 * has run for `TASK_BUDGET_MS` since the last yield, so short loops pay nothing.
 */
export function createYielder(priority: Priority = "user-visible"): () => Promise<void> {
  let deadline = performance.now() + TASK_BUDGET_MS;

  return async function maybeYield(): Promise<void> {
    if (performance.now() < deadline) return;
    await yieldToMain(priority);
    deadline = performance.now() + TASK_BUDGET_MS;
  };
}
