export let SCRAPER_ACTIVE_FLAG = false;

export function stopScraperFlag() {
  console.log("stopping the scraper...");
  SCRAPER_ACTIVE_FLAG = false;
}

export function startScraperFlag() {
  console.log("starting the scraper...");
  SCRAPER_ACTIVE_FLAG = true;
}
