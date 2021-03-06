import { scrapeOrganization } from "./puppeteer/orgs/scrapeOrganization.js";
import { scrapeRepo } from "./puppeteer/repos/scrapeRepo.js";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import { scrapeUserProfile } from "./puppeteer/users/scrapeUser.js";
import { ghSearch } from "./puppeteer/ghSearch.js";
import { taskCounter, TASKLIMIT } from "./puppeteer/taskCounter.js";
import { scrapeFromQueuedb } from "./puppeteer/queue/scrapeFromQueue.js";

const main = async () => {
  if (process.argv.length < 4) {
    console.error("Usage: yarn scrape ['repo' | 'org' | 'user'] [URL]");
    process.exit(1);
  }
  const type = process.argv[2];
  dotenv.config({ path: "./.env" });
  const uri = process.env.URI;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const db = client.db("scraper");

    if (type === "search") {
      const searchType = process.argv[3];
      const query = process.argv[4];
      await ghSearch(query, searchType, db);
    } else {
      const url = process.argv[3];
      if (!url.includes("github.com")) {
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
    const batchSize = Math.min(queueSize, TASKLIMIT);
    let qCounter = 0;
    while (queueSize > 0) {
      const tasks = [];
      while (qCounter < batchSize) {
        tasks.push(scrapeFromQueuedb(db, qCounter));
        qCounter++;
      }
      await Promise.all(tasks);
      qCounter -= TASKLIMIT;
      queueSize = await db.collection("queue").countDocuments();
    }
    await client.close();
  });
  return;
};

main();
