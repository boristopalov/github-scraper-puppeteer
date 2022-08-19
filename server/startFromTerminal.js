import { scrapeOrganization } from "./puppeteer/orgs/scrapeOrganization.js";
import { scrapeRepo } from "./puppeteer/repos/scrapeRepo.js";
import { scrapeUserProfile } from "./puppeteer/users/scrapeUser.js";
import { ghSearch } from "./puppeteer/ghSearch.js";
import { taskCounter, TASKLIMIT } from "./puppeteer/taskCounter.js";
import { scrapeFromQueuedb } from "./puppeteer/queue/scrapeFromQueue.js";
import { isScraperActive } from "./utils/isScraperActive.js";
import { queueTaskdb } from "./utils/queueTask.js";
import dotenv from "dotenv";
import { mongoClient } from "./utils/dbConnect.js";

export const startFromTerminal = async () => {
  if (process.argv.length < 4) {
    console.error("Usage: yarn queue ['repo' | 'org' | 'user'] [URL]");
    process.exit(1);
  }

  const type = process.argv[2];
  const url = process.argv[3];

  if (type !== "repo" && type !== "user" && type !== "org") {
    console.error("Possible types are: 'repo', 'org', or 'user'");
    process.exit(1);
  }
  dotenv.config({ path: "../.env" });
  const client = await mongoClient();

  const db =
    process.env.DB_ENV === "testing"
      ? client.db("testing")
      : client.db("scraper");
  let fn;
  let depth;
  if (type === "repo") {
    fn = "scrapeRepo";
    depth = 2;
  }
  if (type === "org") {
    fn = "scrapeOrganization";
    depth = 1;
  }
  if (type === "user") {
    fn = "scrapeUserProfile";
    depth = 3;
  }
  await queueTaskdb(
    db,
    { type, parentId: null, parentType: null },
    { fn, args: [url] },
    { sendToFront: true, depth }
  );
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
};

startFromTerminal();
