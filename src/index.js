import { scrape } from "./puppeteer/scrape.js";

const main = async () => {
  const url = "https://github.com/Marak?page=12&tab=following";

  // if you want to scrape >100 pages you have to manually change the page url and re-run
  // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 100 pages -> re-run with scrape('https://github.com/mikedemarais?page=101&tab=following')
  const data = await scrape(url);

  // save data to JSON file
  saveData(data);
  return;
};

main();
