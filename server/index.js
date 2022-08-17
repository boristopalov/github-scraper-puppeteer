import { scrapeOrganization } from "./puppeteer/orgs/scrapeOrganization.js";
import { scrapeRepo } from "./puppeteer/repos/scrapeRepo.js";
import { scrapeUserProfile } from "./puppeteer/users/scrapeUser.js";
import { ghSearch } from "./puppeteer/ghSearch.js";
import { taskCounter, TASKLIMIT } from "./puppeteer/taskCounter.js";
import { scrapeFromQueuedb } from "./puppeteer/queue/scrapeFromQueue.js";
import { mongoClient } from "./utils/dbConnect.js";
import { startServer } from "./api/server.js";

const main = async () => {
  try {
    const client = await mongoClient();
    const db =
      process.env.DB_ENV === "testing"
        ? client.db("testing")
        : client.db("scraper");
    console.log(db.databaseName);

    if (process.argv[2] === "server") {
      startServer(db);
      return;
    } else if (process.argv.length < 4) {
      console.error("Usage: yarn scrape ['repo' | 'org' | 'user'] [URL]");
      process.exit(1);
    }
    const type = process.argv[2];
    if (type === "search") {
      const searchType = process.argv[3];
      const query = process.argv[4];
      await ghSearch(query, searchType, db);
    } else {
      const url = process.argv[3];
      if (!url.toLowerCase().includes("github.com")) {
        console.error(`Please enter a valid GitHub url, you entered: ${url}`);
        process.exit(1);
      }
      if (type === "repo") {
        await scrapeRepo(db, url);
      } else if (type === "org") {
        await scrapeOrganization(db, url);
      } else if (type === "user") {
        await scrapeUserProfile(db, url, null, true);
      } else {
        console.error(`possible types - 'repo', 'user', 'org'`);
        process.exit(1);
      }
    }
    console.log("scraping from da queue now ");
    let queueSize = await db.collection("queue").countDocuments(); // use estimatedDocumentCount() instead?
    let batchSize = Math.min(queueSize, TASKLIMIT);
    let qCounter = 0;
    while (queueSize > 0) {
      const tasks = [];
      while (qCounter < batchSize) {
        tasks.push(scrapeFromQueuedb(db, qCounter));
        qCounter++;
      }
      await Promise.all(tasks);
      qCounter -= batchSize;
      queueSize = await db.collection("queue").countDocuments();
      batchSize = Math.min(queueSize, TASKLIMIT);
    }
    await client.close();
    return;
  } catch (e) {
    console.error(e.stack);
  }
};

main();
