import { writeToClient } from "../index.js";
import sleep from "../utils/sleep.js";

export let SCRAPER_ACTIVE_FLAG = false;
export let TASKS_PROCESSING_FLAG = false;
export let INITIAL_TASK_PROCESSING = false;
export let NUM_CONSECUTIVE_TASKS_FAILED = 0;

export function incrementNumConsecutiveTasksFailed() {
  NUM_CONSECUTIVE_TASKS_FAILED++;
}

export function resetNumConsecutiveTasksFailed() {
  NUM_CONSECUTIVE_TASKS_FAILED = 0;
}

export function maybePauseScraperAndResetTasksFailed(res) {
  incrementNumConsecutiveTasksFailed();
  if (NUM_CONSECUTIVE_TASKS_FAILED > 5) {
    writeToClient(res, "pausing scraper for 5 minutes.");
    sleep(60000 * 5); // 5 minutes
    resetNumConsecutiveTasksFailed();
  }
}

export function stopScraperFlag() {
  SCRAPER_ACTIVE_FLAG = false;
}

export function startScraperFlag() {
  SCRAPER_ACTIVE_FLAG = true;
}

export function startTasksProcessingFlag() {
  TASKS_PROCESSING_FLAG = true;
}

export function stopTasksProcessingFlag() {
  TASKS_PROCESSING_FLAG = false;
}

export function stopInitialTaskFlag() {
  INITIAL_TASK_PROCESSING = false;
}

export function startInitialTaskFlag() {
  INITIAL_TASK_PROCESSING = true;
}
