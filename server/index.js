import { scrapeFollowingList } from "./puppeteer/scrapeFollowingList.js";
import express from "express";
import cors from "cors";
import saveData from "./utils/saveData.js";
import { scrapeOrganization } from "./puppeteer/scrapeOrganization.js";
import puppeteer from "puppeteer";
import { scrapeRepo } from "./puppeteer/scrapeRepo.js";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import { scrapeUserProfile } from "./puppeteer/scrapeUserProfile.js";
import { ghSearch } from "./puppeteer/ghSearch.js";
import { taskCounter, TASKLIMIT } from "./puppeteer/taskCounter.js";
import { scrapeFromQueue } from "./puppeteer/scrapeFromQueue.js";

const main = async () => {
  // const app = express();
  // const port = 8080;

  // app.use(cors());
  // app.get("/following/:id", async (req, res) => {
  //   const url = `https://github.com/${req.params.id}?tab=following`;
  //   // if you want to scrape >100 pages you have to manually change the page url and re-run
  //   // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 100 pages -> re-run with scrape('https://github.com/mikedemarais?page=101&tab=following')
  //   // saves the data and returns the path to the data
  //   const data = await scrapeFollowingList(url);
  // });

  // app.get("/org/:id", async (req, res) => {
  //   const url = `https://github.com/${req.params.id}`;
  //   const browser = await puppeteer.launch();
  //   const data = await scrapeOrganization(browser, url);
  // });

  // app.get("/repo/:id", async (req, res) => {
  //   const url = `https://github.com/${req.params.id}`;
  //   const browser = await puppeteer.launch();
  //   const page = await browser.newPage();
  //   const repoPage = await page.goto(url);
  //   const data = await scrapeRepo(repoPage);
  // });

  // app.listen(port, () => {
  //   console.log(`Listening on port ${port}`);
  // });

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
      return;
    }
    const db = client.db("scraper");
    const type = process.argv[2];
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
      let browser;
      if (type === "repo") {
        browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.goto(url);
        await scrapeRepo(browser, page, db, queue);
        await browser.close();
      }
      if (type === "org") {
        browser = await puppeteer.launch({ headless: false });
        await scrapeOrganization(browser, url, db, queue);
      }
      if (type === "user") {
        await scrapeUserProfile(url, true, db, null, queue);
      }
    }
    // in theory there should be 0 tasks at this point
    console.log("There should be 0 tasks now.", "Actual tasks:", taskCounter);
    while (queue.length > 0 && taskCounter < TASKLIMIT) {
      await scrapeFromQueue(queue);
    }
    await client.close();
  });
  // return;
};

main();
