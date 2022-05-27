import puppeteer from "puppeteer";
import getHrefFromAnchor from "../../utils/getHrefFromAnchor.js";
import searchTextForKeywords from "../../utils/searchTextForKeywords.js";
import { generalKeywords } from "../../keywords.js";
import { scrapeTwitterFollowers } from "./scrapeTwitterFollowers.js";
import { scrapeOrganization } from "../scrapeOrganization.js";
import convertNumStringToDigits from "../../utils/convertNumStringToDigits.js";
import { scrapeUserProfileRepos } from "./scrapeUserProfileRepos.js";
import sleep from "../../utils/sleep.js";
import checkForBotDetection from "../../utils/checkForBotDetection.js";
import searchEventsForEmail from "../../utils/searchEventsForEmail.js";
import searchEventsForPullRequests from "../../utils/searchEventsForPullRequests.js";
import { getEvents } from "../../api/getEvents.js";
import { scrapeRepo } from "../scrapeRepo.js";
import { decrementTaskCounter, incrementTaskCounter } from "../taskCounter.js";
import {
  incrementUsersScrapedCounter,
  usersScrapedCounter,
} from "./usersScrapedCounter.js";
import { csvExport } from "../../csvExport.js";
import { queueTask } from "../../utils/queueTask.js";

export const scrapeUserProfile = async (url, db, data = null, queue) => {
  if (await db.collection("scraped_users").findOne({ url: url })) {
    return null;
  }
  if (usersScrapedCounter > 0 && usersScrapedCounter % 100 === 0) {
    csvExport(db);
  }
  let success = false;
  let tries = 1;
  incrementUsersScrapedCounter();
  incrementTaskCounter();
  while (tries > 0 && !success) {
    try {
      data = await tryScrapeUser(url, db, queue);
    } catch (e) {
      console.log(e.stack);
      tries--;
    }
  }
  if (!data) {
    return null;
  }
  await db.collection("scraped_users").insertOne({ url: url });
  await db.collection("users").insertOne(data);
  decrementTaskCounter();
  return null;
};

const tryScrapeUser = async (url, db, queue) => {
  let data = {
    contributionCount: 0,
    tenStarRepoCount: 0,
    isUserReadmeKeywordMatch: false,
    userCompanyIsOrg: false,
    githubFollowers: 0,
    githubFollowing: 0,
    numOrgBioKeywordMatch: 0,
    numOrgReposWithHundredStars: 0,
    numOrgReposReadmeKeywordMatch: 0,
    company: "n/a",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await checkForBotDetection(page);
  await sleep(1000);

  data.tenStarRepoCount = await scrapeUserProfileRepos(page);

  const readmeElement = await page.$(
    "article.markdown-body.entry-content.container-lg.f5"
  );
  if (readmeElement) {
    // $eval() crashes puppeteer if it doesn't find the element so we need to check if the element exists first
    const readmeText = await page.evaluate((e) => e.innerText, readmeElement);
    data.isUserReadmeKeywordMatch = searchTextForKeywords(
      readmeText,
      generalKeywords
    );
  }

  const contributionCount = await page.$eval(
    ".js-yearly-contributions > div > h2",
    (e) => e.innerText.split(" ")[0].replace(",", "")
  );
  data.contributionCount = parseInt(contributionCount);

  const followersDiv = await page.$("span.text-bold.color-fg-default");
  if (followersDiv) {
    let followersCountText = await page.evaluate(
      (e) => e.innerText,
      followersDiv
    );
    followersCountText = followersCountText.replace(",", "");
    data.githubFollowers = convertNumStringToDigits(followersCountText);
  }

  const followingEl = await page.$(
    ".flex-order-1.flex-md-order-none.mt-2.mt-md-0 > div > a:nth-child(2) > span"
  );
  if (followingEl) {
    const text = await page.evaluate((e) => e.innerText, followingEl);
    data.githubFollowing = convertNumStringToDigits(text);
  }

  const company = await page.$("span.p-org");
  let companyText = company
    ? await (await company.getProperty("textContent")).jsonValue()
    : "n/a";
  data.company = companyText.trim().split(/\s+/).join(" ");

  const userCompanyIsOrg = await getHrefFromAnchor(page, ".p-org > div > a");
  if (userCompanyIsOrg) {
    data.userCompanyIsOrg = true;
  }

  // if user is a member of any organizations, scrape data from each organization
  let orgs = await page.$$(
    ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a[data-hovercard-type ='organization']"
  );
  if (!orgs) {
    return data;
  }
  orgs = orgs.slice(0, 5); // only scrape 5 orgs at most
  await enqueueUserOrgs(queue, orgs, db);
  await browser.close();
  return data;
};

const enqueueUserOrgs = async (queue, orgs, db) => {
  const orgUrls = await Promise.all(
    orgs.map((org) => org.getProperty("href").then((res) => res.jsonValue()))
  );
  for (const url of orgUrls) {
    if (await db.collection("scraped_orgs").findOne({ url: url })) {
      continue;
    }
    queueTask(
      queue,
      {
        db: db,
        type: "org",
        parentType: "user",
        parentId: data.username,
      },
      async () => await scrapeOrganization(url, db, queue)
    );
  }
};

const scrapeStartingData = async (page, db) => {
  data = {
    name: "n/a",
    email: "n/a",
    username: "n/a",
    location: "n/a",
    isInNewYork: false,
    bio: "n/a",
    githubUrl: "n/a",
    bioMatchesKeywords: false,
    repoCommits: [],
    numPullRequestReposWithHundredStars: 0,
    numPullRequestReposWithReadmeKeywordMatch: 0,
    queuedTasks: 0,
    exported: false,
  };
  const name = await page.$eval("span[itemprop='name']", (e) => e.innerText);
  data.name = name;
  const username = await page.$eval(
    "span[itemprop='additionalName']",
    (e) => e.innerText
  );
  data.username = username;

  data.githubUrl = `https://github.com/${username}`;
  const events = await getEvents(username);
  const email = await searchEventsForEmail(events, username, name);
  data.email = email;

  const bio = await page.$(
    ".p-note.user-profile-bio.mb-3.js-user-profile-bio.f4 > div"
  );
  let bioText = bio
    ? await (await bio.getProperty("textContent")).jsonValue()
    : "n/a";
  bioText = bioText.trim().toLowerCase();
  data.bio = bioText;
  const bioMatchesKeywords = searchTextForKeywords(bioText, generalKeywords);
  data.bioMatchesKeywords = bioMatchesKeywords;

  // location not always displayed
  const location = await page.$("li[itemprop='homeLocation'] > span");
  let locationText = location
    ? await (await location.getProperty("textContent")).jsonValue()
    : "n/a";
  locationText = locationText.trim();
  let locationArr = locationText.split(/\s+/);

  // work-around to get rid of work text, sometimes the data retrieval is iffy
  // locationArr = locationArr.filter((e) => !workArr.includes(e));
  locationText = locationArr.length > 0 ? locationArr.join(" ") : "n/a";
  locationText = locationText.toLowerCase();
  data.location = locationText;

  const isInNewYork =
    searchTextForKeywords(locationText, ["new york", "ny"]) &&
    !searchTextForKeywords(locationText, ["germany", "sunnyvale"]);

  data.isInNewYork = isInNewYork;
  const pullRequestRepoUrls = searchEventsForPullRequests(events);
  for (const url of pullRequestRepoUrls) {
    if (await db.collection("scraped_repos").findOne({ url: url })) {
      continue;
    }
    queueTask(
      queue,
      {
        db,
        type: "repo",
        parentType: "user",
        parentId: username,
      },
      async () => await scrapeRepo(url, db, queue)
    );
  }
  return data;
};
