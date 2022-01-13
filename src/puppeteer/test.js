import { getEvents } from "../api/getEvents.js";
import searchEventsForPullRequests from "../utils/searchEventsForPullRequests.js";
import { scrapeRepo } from "./scrapeRepo.js";
import puppeteer from "puppeteer";

const usernameText = "quentinperez";
const events = await getEvents(usernameText);
const pullRequestRepoUrls = searchEventsForPullRequests(events, usernameText);

const browser = await puppeteer.launch({ headless: false });

for (const url of pullRequestRepoUrls) {
  console.log(url);
  const page = await browser.newPage();
  await page.goto(url);
  const data = await scrapeRepo(page);
  console.log(data);
}
