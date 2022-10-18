import { scrapeOrganization } from "./puppeteer/orgs/scrapeOrganization.js";
import { scrapeRepo } from "./puppeteer/repos/scrapeRepo.js";
import { scrapeUserProfile } from "./puppeteer/users/scrapeUser.js";
import { TASKLIMIT } from "./puppeteer/taskCounter.js";
import { scrapeFromQueuedb } from "./puppeteer/queue/scrapeFromQueue.js";
import { isScraperActive } from "./utils/isScraperActive.js";
import {
  STOP_SCRAPER_FLAG,
  startScraperFlag,
} from "./puppeteer/stopScraperFlag.js";

const scrape = async (db, type, url, res) => {
  if (!url.toLowerCase().includes("github.com")) {
    console.error(
      `error- please enter a valid GitHub url, you entered: ${url}`
    );
    return;
  }
  console.log(type, url);
  if (type === "org") {
    await scrapeOrganization(db, url, { sendToFront: true, depth: 1 }, res);
  } else if (type === "repo") {
    await scrapeRepo(db, url, { sendToFront: true, depth: 2 }, res);
  } else if (type === "user") {
    await scrapeUserProfile(
      db,
      url,
      null,
      {
        sendToFront: true,
        depth: 3,
      },
      res
    );
  } else {
    console.error(`error- possible types - 'repo', 'user', 'org'`);
    return;
  }
  if (await isScraperActive(db)) {
    console.log(
      "Scraper is already running and should be scraping from the queue."
    );
    return;
  }
  if (STOP_SCRAPER_FLAG) {
    startScraperFlag();
  }
  console.log("scraping from da queue now ");
  let queueSize = await db.collection("queue").countDocuments(); // use estimatedDocumentCount() instead?
  let batchSize = Math.min(queueSize, TASKLIMIT);
  let qCounter = 0;
  while (queueSize > 0 && !STOP_SCRAPER_FLAG) {
    const tasks = [];
    while (qCounter < batchSize) {
      tasks.push(scrapeFromQueuedb(db, qCounter, res));
      qCounter++;
    }
    await Promise.all(tasks);
    qCounter -= batchSize;
    queueSize = await db.collection("queue").countDocuments();
    batchSize = Math.min(queueSize, TASKLIMIT);
  }
  return;
};

export const start = async (db, type, url, res) => {
  let tries = 2;
  while (tries > 0) {
    try {
      await scrape(db, type, url, res);
      return;
    } catch (e) {
      console.error(e);
      console.error(`Error happened for ${type} ${url}`);
      tries--;
    }
  }
};
