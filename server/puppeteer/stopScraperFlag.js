export let STOP_SCRAPER_FLAG = false;
export function stopScraperFlag() {
  STOP_SCRAPER_FLAG = true;
}

export function startScraperFlag() {
  STOP_SCRAPER_FLAG = false;
}
