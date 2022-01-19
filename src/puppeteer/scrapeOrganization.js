import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { readmeKeywords, generalKeywords } from "../keywords.js";
import getHrefFromAnchor from "../utils/getHrefFromAnchor.js";
import { scrapeRepo } from "./scrapeRepo.js";
import sleep from "../utils/sleep.js";
import checkForBotDetection from "../utils/checkForBotDetection.js";

export const scrapeOrganization = async (browser, url) => {
  const data = {
    bioKeywordMatch: false,
    numReposWithHundredStars: 0,
    numRepoReadmeKeywordMatch: 0,
  };
  const page = await browser.newPage();
  // go to organization page and sort repos by number of stars
  await page.goto(url);
  await checkForBotDetection(page);
  // await sleep(1000);
  await page.waitForSelector(
    ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
  );
  const header = await page.$(
    ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
  );

  const orgName = await header.$eval(".flex-1 > h1", (e) => e.innerText);
  const orgBio =
    (await header.$eval(".flex-1 > div > div", (e) => e.innerText)) ||
    "no org bio";
  if (orgBio !== "no org bio") {
    const bioContainsKeywords = searchTextForKeywords(orgBio, generalKeywords);
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

  await page.waitForSelector(".org-repos.repo-list > div > ul > li");
  let repos = await page.$$(".org-repos.repo-list > div > ul > li");
  if (repos.length === 0) {
    console.log(`No repos for ${orgName}`);
    return new Promise((resolve) => {
      resolve(data);
    });
  }
  // only look at the top 3 repos
  else if (repos.length > 3) {
    repos = repos.slice(0, 3);
  }

  const promises = [];
  for await (const repo of repos) {
    const repoUrl = await getHrefFromAnchor(
      repo,
      ".d-flex.flex-justify-between > div > a"
    );
    const repoPage = await browser.newPage();
    await repoPage.goto(repoUrl);
    promises.push(await scrapeRepo(repoPage));
  }
  const results = await Promise.all(promises);
  for (const result of results) {
    if (result.repoStarCount >= 100) {
      data.numReposWithHundredStars++;
    }
    if (result.isRepoReadmeKeywordMatch) {
      data.numRepoReadmeKeywordMatch++;
    }
  }

  // console.log(`Results for ${orgName}`, results);
  // console.log(`Data for ${orgName}`, data);
  await page.close();
  return new Promise((resolve) => {
    resolve(data);
  });
};

// import puppeteer from "puppeteer";
// const browser = await puppeteer.launch({ headless: false });
// scrapeOrganization(browser, "https://github.com/fossasia");
