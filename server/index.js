import { scrape } from "./puppeteer/scrape.js";
import express from "express";
import cors from "cors";
import saveData from "./utils/saveData.js";
import { scrapeOrganization } from "./puppeteer/scrapeOrganization.js";
import puppeteer from "puppeteer";
import { scrapeRepo } from "./puppeteer/scrapeRepo.js";

const main = async () => {
  const app = express();
  const port = 8080;

  app.use(cors());
  app.get("/following/:id", async (req, res) => {
    const url = `https://github.com/${req.params.id}?tab=following`;
    // if you want to scrape >100 pages you have to manually change the page url and re-run
    // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 100 pages -> re-run with scrape('https://github.com/mikedemarais?page=101&tab=following')
    // saves the data and returns the path to the data
    const data = await scrape(url);
    const pathToData = saveData(data);
    console.log("path", pathToData);
    res.download(pathToData);
  });

  app.get("/org/:id", async (req, res) => {
    const url = `https://github.com/${req.params.id}`;
    const browser = await puppeteer.launch();
    const data = await scrapeOrganization(browser, url);
    const pathToData = saveData(data);
    res.download(pathToData);
  });

  app.get("/repo/:id", async (req, res) => {
    const url = `https://github.com/${req.params.id}`;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const repoPage = await page.goto(url);
    const data = await scrapeRepo(repoPage);
    const pathToData = saveData(data);
    res.download(pathToData);
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });

  // if you want to scrape >100 pages you have to manually change the page url and re-run
  // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 100 pages -> re-run with scrape('https://github.com/mikedemarais?page=101&tab=following')
  // const data = await scrape(url);

  // save data to JSON file
  // saveData(data);
  // return;
};

main();
