import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { readmeKeywords, generalKeywords } from "../keywords.js";
import getHrefFromAnchor from "../utils/getHrefFromAnchor.js";
import { scrapeRepo } from "./scrapeRepo.js";
import sleep from "../utils/sleep.js";
import checkForBotDetection from "../utils/checkForBotDetection.js";
import fs from "fs";
import puppeteer from "puppeteer";
import { MongoClient, ServerApiVersion } from "mongodb";
import saveData from "../utils/saveData.js";
import dotenv from "dotenv";

export const scrapeOrganization = async (browser, url, db = null) => {
  try {
    const data = {
      name: "n/a",
      bioKeywordMatch: false,
      numReposWithHundredStars: 0,
      numRepoReadmeKeywordMatch: 0,
      reposInOrg: [],
    };
    const page = await browser.newPage();

    // go to organization page and sort repos by number of stars
    await page.goto(url);
    await checkForBotDetection(page);
    await sleep(1000);
    await page.waitForSelector(
      ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
    );
    const header = await page.$(
      ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
    );

    const orgName = await header.$eval(".flex-1 > h1", (e) => e.innerText);
    data.name = orgName;
    const orgBio =
      (await header.$eval(".flex-1 > div > div", (e) => e.innerText)) ||
      "no org bio";
    data.orgBio = orgBio;
    if (orgBio !== "no org bio") {
      const bioContainsKeywords = searchTextForKeywords(
        orgBio,
        generalKeywords
      );
      data["bioKeywordMatch"] = bioContainsKeywords;
    }

    await page.waitForSelector(
      ".col-12 > .d-flex > .d-flex > #type-options > .btn"
    );
    await page.click(".col-12 > .d-flex > .d-flex > #type-options > .btn");

    await page.waitForSelector(
      "#type-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
    );
    await page.click(
      "#type-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
    );
    await sleep(1000);

    await page.waitForSelector(
      ".col-12 > .d-flex > .d-flex > #sort-options > .btn"
    );
    await page.click(".col-12 > .d-flex > .d-flex > #sort-options > .btn");

    await page.waitForSelector(
      "#sort-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
    );
    await page.click(
      "#sort-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
    );
    await sleep(1000);

    let repos = await page.$$(".org-repos.repo-list > div > ul > li");
    if (repos.length === 0) {
      console.log(`No repos for ${orgName}`);
      await page.close();
      return new Promise((resolve) => {
        resolve(data);
      });
    }
    // only look at the top 5 repos
    else if (repos.length > 5) {
      repos = repos.slice(0, 5);
    }

    const repoUrls = [];
    for (const repo of repos) {
      const repoUrl = await getHrefFromAnchor(
        repo,
        ".d-flex.flex-justify-between > div > a"
      );
      repoUrls.push(repoUrl);
    }
    data.reposInOrg = repoUrls;

    for (const repoUrl of repoUrls) {
      if (!(await db.collection("scraped_repos").findOne({ url: repoUrl }))) {
        // weird work-around
        await db.collection("scraped_repos").insertOne({ url: repoUrl });
        const repoPage = await browser.newPage();
        await repoPage.goto(repoUrl);
        const repoData = await scrapeRepo(repoPage, db);
        if (repoData.repoStarCount >= 100) {
          data.numReposWithHundredStars++;
        }
        if (repoData.isRepoReadmeKeywordMatch) {
          data.numRepoReadmeKeywordMatch++;
        }
      }
    }

    if (!(await db.collection("orgs").findOne({ name: orgName }))) {
      await db.collection("orgs").insertOne(data);
    }

    // const scrapedOrgsFile = "../../data/scraped-orgs.json";
    // fs.readFile(scrapedOrgsFile, (e, content) => {
    //   const json = JSON.parse(content);

    //   if (!json[orgName]) {
    //     json[orgName] = true;
    //     fs.writeFile(scrapedOrgsFile, JSON.stringify(json), (e) => {
    //       if (e) {
    //         console.log(e);
    //       }
    //     });
    //   }
    // });

    await browser.close();
    return new Promise((resolve) => {
      resolve(data);
    });
  } catch (e) {
    console.log(e.message);
    await browser.close();
    return new Promise((resolve) => {
      resolve(data);
    });
  }
};

dotenv.config();

// const uri =
//  process.env.URI;
// const client = new MongoClient(uri, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   serverApi: ServerApiVersion.v1,
// });
// const browser = await puppeteer.launch({ headless: false });
// client.connect(async (err) => {
//   if (err) {
//     console.log(err);
//   }
//   const db = client.db("scraper");
//   await scrapeOrganization(browser, "https://github.com/glossier", db);
//   // saveData(res);
//   await client.close();
// });
