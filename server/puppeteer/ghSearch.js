import puppeteer from "puppeteer";
import axios from "axios";
import { scrapeUserProfile } from "./scrapeUserProfile.js";
import { scrapeRepo } from "./scrapeRepo.js";
const TOKEN = process.env.TOKEN;

export const ghSearch = async (query, type, db) => {
  // add in options for users or repos or other types
  // error handling ?
  // rate limit: 30 requests per minute since we are authenticated
  const url = `https://api.github.com/search/${type}?q=${query}`;
  const res = await axios
    .get(url, {
      headers: {
        Authorization: `token ${TOKEN}`,
        "Content-Type": "application/json",
      },
    })
    .catch((error) => console.log(error.message));
  if (res.data) {
    const data = res.data;
    if (type === "repositories") {
      for (const item of data.items) {
        const url = item.html_url;
        if (!(await db.collection("scraped_repos").findOne({ url: url }))) {
          await db.collection("scraped_repos").insertOne({ url: url });
          const browser = await puppeteer.launch({ headless: true });
          const page = await browser.newPage();
          await page.goto(repoUrl);
          console.log(`${repoUrl} not found in DB, scraping it...`);
          await scrapeRepo(browser, page, db);
        }
      }
    }
    if (type === "users") {
      const username = item.login;
      if (
        !(await db.collection("scraped_users").findOne({ username: username }))
      ) {
        await db.collection("scraped_users").insertOne({ username: username });
        console.log(`${username} not found in DB, scraping the user...`);
        await scrapeUserProfile(item.html_url, true, db);
      }
    }

    console.log("all done!");
    return;
  } else {
    console.log("no users to scrape!");
    return;
  }
};
