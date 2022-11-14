import { scrapeOrganization } from "./orgs/scrapeOrganization.js";
import { scrapeRepo } from "./repos/scrapeRepo.js";
import { scrapeUserProfile } from "./users/scrapeUser.js";
import { TASKLIMIT } from "../utils/taskCounter.js";
import { scrapeFromQueuedb } from "./queue/scrapeFromQueue.js";
import {
  SCRAPER_ACTIVE_FLAG,
  stopScraperFlag,
} from "../utils/scraperStatus.js";
import { writeToClient } from "../index.js";

export const scrape = async (db, type, url, res) => {
  url = url.toLowerCase();
  if (!url.includes("github.com")) {
    console.error(
      `error- please enter a valid GitHub url, you entered: ${url}`
    );
    writeToClient(res, `please enter a valid GitHub url, you entered: ${url}`);
    return;
  }
  if (type === "org") {
    await scrapeOrganization(db, { sendToFront: true, priority: 3 }, res, url);
  } else if (type === "repo") {
    await scrapeRepo(db, { sendToFront: true, priority: 2 }, res, url);
  } else if (type === "user") {
    await scrapeUserProfile(
      db,
      {
        sendToFront: true,
        priority: 1,
      },
      res,
      url,
      null
    );
  } else {
    console.error(`error- possible types - 'repo', 'user', 'org'`);
    return;
  }
  console.log("scraping from da queue now ");
  await scrapeFromQueueLoop(db, res);
};

export const scrapeFromQueueLoop = async (db, res) => {
  let queueSize = await db.collection("queue").countDocuments(); // use estimatedDocumentCount() instead?
  let batchSize = Math.min(queueSize, TASKLIMIT);
  let qCounter = 0;
  while (queueSize > 0 && SCRAPER_ACTIVE_FLAG) {
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
  stopScraperFlag();
  return;
};
