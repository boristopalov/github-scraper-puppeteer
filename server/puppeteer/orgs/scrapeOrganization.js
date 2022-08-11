import puppeteer from "puppeteer";
import searchTextForKeywords from "../../utils/searchTextForKeywords.js";
import { readmeKeywords, generalKeywords } from "../../keywords.js";
import getHrefFromAnchor from "../../utils/getHrefFromAnchor.js";
import sleep from "../../utils/sleep.js";
import checkForBotDetection from "../../utils/checkForBotDetection.js";
import { queueTaskdb } from "../../utils/queueTask.js";
import waitForAndSelect from "../../utils/waitForAndSelect.js";
import { updateOrgRepo } from "../queue/scrapeFromQueue.js";

export const scrapeOrganization = async (
  db,
  url,
  { sendToFront = false, depth = 0 } = {}
) => {
  if (await db.collection("scraped_orgs").findOne({ url })) {
    console.log("Already scraped", url);
    return null;
  }
  let tries = 2;
  while (tries > 0) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    try {
      const data = await tryScrapeOrg(page, db, { sendToFront, depth });
      await db.collection("orgs").insertOne(data);
      return data;
    } catch (e) {
      console.error(e.stack);
      console.error("Error occured for:", url);
      tries--;
    } finally {
      await browser.close();
    }
  }
  return null;
};

const tryScrapeOrg = async (page, db, { sendToFront, depth }) => {
  const data = {
    name: "n/a",
    url: page.url(),
    bioKeywordMatch: false,
    numReposWithHundredStars: 0,
    numRepoReadmeKeywordMatch: 0,
    reposInOrg: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await checkForBotDetection(page);

  const header = await waitForAndSelect(
    page,
    ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
  );

  const namePromise = (async () => {
    const name = await header.$eval(".flex-1 > h1", (e) => e.innerText);
    data.name = name;
    return name;
  })();

  const bioPromise = (async () => {
    const bio = await header.$eval(".flex-1 > div > div", (e) => e.innerText);
    const bioText = bio || "n/a";
    data.orgBio = bioText;
    return bioText;
  })();

  const bioContainsKeywordsPromise = (async () => {
    const bio = await bioPromise;
    if (bio === "n/a") {
      return;
    }
    const bioContainsKeywords = searchTextForKeywords(bio, generalKeywords);
    data.bioKeywordMatch = bioContainsKeywords;
  })();

  const repoUrls = await getOrgRepoUrls(page);
  if (!repoUrls || repoUrls.length === 0) {
    return data;
  }
  data.reposInOrg = repoUrls;

  const enqueueRepoPromises = repoUrls.map(async (url) => {
    const orgName = await namePromise;
    const repoData = await db.collection("repos").findOne({ url });
    if (repoData) {
      await updateOrgRepo(repoData, db, data.name);
      return data;
    }
    if (await db.collection("queue").findOne({ "task.args.0": url })) {
      return data;
    }
    if (!sendToFront || depth > 3) {
      sendToFront = false;
      depth = 0;
    } else {
      depth++;
    }
    await queueTaskdb(
      db,
      {
        type: "repo",
        parentType: "org",
        parentId: orgName,
      },
      {
        fn: "scrapeRepo",
        args: [url],
      },
      { sendToFront, depth }
    );
  });
  await Promise.all([bioContainsKeywordsPromise, enqueueRepoPromises]);
  return data;
};

const getOrgRepoUrls = async (page) => {
  const tab = await page.$(
    ".col-12 > .d-flex > .d-flex > #type-options > .btn"
  );
  if (!tab) {
    console.log("No repos for", page.url());
    return null;
  }
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

  const repos = await page.$$(".org-repos.repo-list > div > ul > li");
  if (!repos) {
    console.log("No repos for", page.url());
    return null;
  }
  // only look at the top 5 repos
  const reposToEval = repos.slice(0, 5);
  const repoUrls = [];
  for (const repo of reposToEval) {
    const repoUrl = await getHrefFromAnchor(
      repo,
      ".d-flex.flex-justify-between > div > a"
    );
    repoUrls.push(repoUrl);
  }
  return repoUrls;
};
