import puppeteer from "puppeteer";
import getHrefFromAnchor from "../../utils/getHrefFromAnchor.js";
import searchTextForKeywords from "../../utils/searchTextForKeywords.js";
import { generalKeywords } from "../../keywords.js";
import { scrapeOrganization } from "../orgs/scrapeOrganization.js";
import convertNumStringToDigits from "../../utils/convertNumStringToDigits.js";
import { scrapeUserProfileRepos } from "./scrapeUserProfileRepos.js";
import sleep from "../../utils/sleep.js";
import checkForBotDetection from "../../utils/checkForBotDetection.js";
import searchEventsForEmail from "../../utils/searchEventsForEmail.js";
import searchEventsForPullRequests from "../../utils/searchEventsForPullRequests.js";
import { getEvents } from "../../api/getEvents.js";
import { scrapeRepo } from "../repos/scrapeRepo.js";
import { decrementTaskCounter, incrementTaskCounter } from "../taskCounter.js";
import {
  incrementUsersScrapedCounter,
  usersScrapedCounter,
} from "./usersScrapedCounter.js";
import { csvExport } from "../../csvExport.js";
import { queueTask } from "../../utils/queueTask.js";
import waitForAndSelect from "../../utils/waitForAndSelect.js";

export const scrapeUserProfile = async (
  url,
  db,
  data = null,
  queue,
  isStartingScrape = false
) => {
  // if (await db.collection("scraped_users").findOne({ url: url })) {
  //   return null;
  // }

  if (usersScrapedCounter > 0 && usersScrapedCounter % 100 === 0) {
    csvExport(db);
  }

  if (isStartingScrape) {
    const newData = await scrapeStartingData(url, db, queue);
    data = {
      ...data,
      ...newData,
    };
  }

  let success = false;
  let tries = 1;
  while (tries > 0 && !success) {
    try {
      const newData = await tryScrapeUser(url, db, queue);
      data = {
        ...data,
        ...newData,
      };
      success = true;
    } catch (e) {
      console.error(e.stack);
      tries--;
    }
  }
  if (!data) {
    return null;
  }
  incrementUsersScrapedCounter();
  await db.collection("scraped_users").insertOne({ url: url });
  await db.collection("users").insertOne(data);
  return data;
};

const tryScrapeUser = async (url, db, queue) => {
  const data = {
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

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);
  await checkForBotDetection(page);

  data.tenStarRepoCount = await scrapeUserProfileRepos(url);

  const readmePromise = (async () => {
    const readmeElement = await page.$(
      "article.markdown-body.entry-content.container-lg.f5"
    );
    if (!readmeElement) {
      return;
    }
    const readMe = await readmeElement.evaluate((el) => el.textContent);
    const innerTextProperty = await readMe.jsonValue();
    data.isUserReadmeKeywordMatch = searchTextForKeywords(
      innerTextProperty,
      generalKeywords
    );
  })();

  const contributionsPromise = (async () => {
    const contributorsElement = await waitForAndSelect(
      page,
      ".js-yearly-contributions > div > h2"
    );
    const contributionCount = await contributorsElement.evaluate(
      (el) => el.textContent
    );
    data.contributionCount = parseInt(contributionCount);
  })();

  const followersPromise = (async () => {
    const followersElement = await page.$("span.text-bold.color-fg-default");
    if (!followersElement) {
      return;
    }
    const followersCountText = await followersElement.evaluate(
      (el) => el.innerText
    );
    const parsedFollowersCountText = followersCountText.replace(",", "");
    data.githubFollowers = convertNumStringToDigits(parsedFollowersCountText);
  })();

  const followingPromise = (async () => {
    const followingElement = await page.$(
      ".flex-order-1.flex-md-order-none.mt-2.mt-md-0 > div > a:nth-child(2) > span"
    );
    if (!followingElement) {
      return;
    }
    const followingCountText = await followingElement.evaluate(
      (el) => el.innerText
    );
    data.githubFollowing = convertNumStringToDigits(followingCountText);
  })();

  const companyPromise = (async () => {
    const company = await page.$("span.p-org");
    if (!company) {
      data.company = "n/a";
      return;
    }
    const companyText = await company.getProperty("textContent");
    const companyTextValue = await companyText.jsonValue();
    data.company = companyTextValue.trim().split(/\s+/).join(" ");
  })();

  const companyIsOrgPromise = (async () => {
    const companyIsOrg = await getHrefFromAnchor(page, ".p-org > div > a");
    if (companyIsOrg) {
      data.userCompanyIsOrg = true;
    }
  })();

  const enqueueUserOrgsPromise = (async () => {
    const orgs = await page.$$(
      ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a[data-hovercard-type ='organization']"
    );
    if (!orgs) {
      return;
    }
    const orgsToQueue = orgs.slice(0, 5); // only scrape 5 orgs at most
    enqueueUserOrgs(queue, orgsToQueue, db);
  })();

  await Promise.all([
    readmePromise,
    contributionsPromise,
    followersPromise,
    followingPromise,
    companyPromise,
    companyIsOrgPromise,
    enqueueUserOrgsPromise,
  ]);
  await browser.close();
  return data;
};

const enqueueUserOrgs = async (queue, orgs, db) => {
  const promises = orgs.map(async (org) => {
    const urlElement = await org.getProperty("href");
    const url = await urlElement.jsonValue();
    if (await db.collection("scraped_orgs").findOne({ url })) {
      return;
    }
    queueTask(
      queue,
      {
        db: db,
        type: "org",
        parentType: "user",
        parentId: data.username,
      },
      () => scrapeOrganization(url, db, queue)
    );
  });
  await Promise.all(promises);
};

const scrapeStartingData = async (url, db, queue) => {
  const data = {
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

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);

  const namePromise = (async () => {
    const nameElement = await waitForAndSelect(page, "span[itemprop='name']");
    const name = await nameElement.evaluate((el) => el.innerText);
    data.name = name;
    return name;
  })();

  const usernamePromise = (async () => {
    const usernameElement = await waitForAndSelect(
      page,
      "span[itemprop='additionalName']"
    );
    const username = await usernameElement.evaluate((el) => el.innerText);
    data.username = username;
    data.githubUrl = `https://github.com/${username}`;
    return username;
  })();

  const eventsPromise = (async () => {
    const username = await usernamePromise;
    return await getEvents(username);
  })();

  const emailPromise = (async () => {
    const [name, username, events] = await Promise.all([
      namePromise,
      usernamePromise,
      eventsPromise,
    ]);
    const email = await searchEventsForEmail(events, username, name);
    data.email = email;
    return email;
  })();

  const bioTextPromise = (async () => {
    const bio = await page.$(
      ".p-note.user-profile-bio.mb-3.js-user-profile-bio.f4 > div"
    );
    if (!bio) {
      return "n/a";
    }
    const textContentProperty = await bio.getProperty("textContent");
    return await textContentProperty.jsonValue();
  })();

  const bioPromise = (async () => {
    const bioText = await bioTextPromise;
    const parsedBioText = bioText.trim().toLowerCase();
    data.bio = parsedBioText;

    const bioMatchesKeywords = searchTextForKeywords(bioText, generalKeywords);
    data.bioMatchesKeywords = bioMatchesKeywords;

    return parsedBioText;
  })();

  const pageLocationTextPromise = (async () => {
    const location = await page.$("li[itemprop='homeLocation'] > span");
    if (!location) {
      return "n/a";
    }
    const locationTextProperty = await location.evalaute(
      (el) => el.textContent
    );
    return await locationTextProperty.jsonValue();
  })();

  const locationPromise = (async () => {
    const pageLocationText = await pageLocationTextPromise;
    const parsedPageLocationText = pageLocationText.trim();
    const locationArr = parsedPageLocationText.split(/\s+/);

    const locationText = locationArr.length > 0 ? locationArr.join(" ") : "n/a";
    const parsedLocationText = locationText.toLowerCase();
    data.location = parsedLocationText;

    const isInNewYork =
      searchTextForKeywords(parsedLocationText, ["new york", "ny"]) &&
      !searchTextForKeywords(parsedLocationText, ["germany", "sunnyvale"]);
    data.isInNewYork = isInNewYork;

    return parsedLocationText;
  })();

  const queuePromise = (async () => {
    const [username, events] = await Promise.all([
      usernamePromise,
      eventsPromise,
    ]);
    const pullRequestRepoUrls = searchEventsForPullRequests(events);
    const queuePromises = pullRequestRepoUrls.map(async (url) => {
      const dbResults = await db.collection("scraped_repos").findOne({ url });
      if (dbResults) {
        return;
      }
      queueTask(
        queue,
        {
          db,
          type: "repo",
          parentType: "user",
          parentId: username,
        },
        () => scrapeRepo(url, db, queue)
      );
    });
    await Promise.all(queuePromises);
  })();

  await Promise.all([
    namePromise,
    usernamePromise,
    emailPromise,
    bioPromise,
    locationPromise,
    queuePromise,
  ]);
  await browser.close();
  return data;
};
