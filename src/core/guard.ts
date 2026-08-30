export type Guard = {
  run: () => Promise<void>;
  readonly busy: boolean;
};

/**
 * One run at a time. A call made while the task is still running is dropped
 * rather than queued: a second click on Save means an impatient user, not a
 * second watch. The task releases however it ends, so a failure can be retried.
 */
export function onceAtATime(task: () => Promise<void>): Guard {
  let running = false;
  return {
    run: async () => {
      if (running) return;
      running = true;
      try {
        await task();
      } finally {
        running = false;
      }
    },
    get busy() {
      return running;
    },
  };
}
