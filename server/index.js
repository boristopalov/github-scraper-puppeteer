import { scrapeOrganization } from "./puppeteer/orgs/scrapeOrganization.js";
import { scrapeRepo } from "./puppeteer/repos/scrapeRepo.js";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import { scrapeUserProfile } from "./puppeteer/users/scrapeUser.js";
import { ghSearch } from "./puppeteer/ghSearch.js";
import { taskCounter, TASKLIMIT } from "./puppeteer/taskCounter.js";
import { scrapeFromQueue } from "./puppeteer/queue/scrapeFromQueue.js";

const main = async () => {
  const queue = [];
  dotenv.config({ path: "./.env" });
  const uri = process.env.URI;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    const db = client.db("scraper");
    const type = process.argv[2];
    if (type === "search") {
      const searchType = process.argv[3];
      const query = process.argv[4];
      await ghSearch(query, searchType, db, queue);
    } else {
      const url = process.argv[3];
      if (!url.includes("github.com")) {
        console.error(`Please enter a valid GitHub url, you entered: ${url}`);
        process.exit(1);
      }
      if (type === "repo") {
        await scrapeRepo(url, db, queue);
      }
      if (type === "org") {
        await scrapeOrganization(url, db, queue);
      }
      if (type === "user") {
        await scrapeUserProfile(url, db, null, queue, true);
      }
    }
    console.log("scraping from da queue now ");
    console.log(queue);
    while (queue.length > 0) {
      if (taskCounter < TASKLIMIT) {
        await scrapeFromQueue(queue);
      }
    }
    await client.close();
  });
  return;
};

main();
