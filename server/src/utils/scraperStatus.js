export let SCRAPER_ACTIVE_FLAG = false;
export let TASKS_PROCESSING_FLAG = false;
export let INITIAL_TASK_PROCESSING = false;

export function stopScraperFlag() {
  console.log("stopping the scraper...");
  SCRAPER_ACTIVE_FLAG = false;
}

export function startScraperFlag() {
  console.log("starting the scraper...");
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
