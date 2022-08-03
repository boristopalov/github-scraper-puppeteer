import puppeteer from "puppeteer";
import getHrefFromAnchor from "../../utils/getHrefFromAnchor.js";
import searchTextForKeywords from "../../utils/searchTextForKeywords.js";
import { generalKeywords } from "../../keywords.js";
import convertNumStringToDigits from "../../utils/convertNumStringToDigits.js";
import { scrapeUserProfileRepos } from "./scrapeUserProfileRepos.js";
import checkForBotDetection from "../../utils/checkForBotDetection.js";
import searchEventsForEmail from "../../utils/searchEventsForEmail.js";
import searchEventsForPullRequests from "../../utils/searchEventsForPullRequests.js";
import { getEvents } from "../../utils/getEvents.js";
import { queueTaskdb } from "../../utils/queueTask.js";
import waitForAndSelect from "../../utils/waitForAndSelect.js";
import { updateUserOrg, updateUserRepo } from "../queue/scrapeFromQueue.js";

export const scrapeUserProfile = async (db, url, data = null) => {
  console.log(url);
  if (await db.collection("users").findOne({ githubUrl: url })) {
    console.log("Already scraped", url);
    return null;
  }

  let tries = 2;
  while (tries > 0) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    try {
      const scrapedData = await tryScrapeUser(page, db);
      const fullData = {
        ...data,
        ...scrapedData,
      };

      await db.collection("users").insertOne(fullData);
      return fullData;
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

const tryScrapeUser = async (page, db) => {
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

  await checkForBotDetection(page);

  data.tenStarRepoCount = await scrapeUserProfileRepos(page.url());

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

  const pageLocationTextPromise = (async () => {
    const location = await page.$("li[itemprop='homeLocation'] > span");
    if (!location) {
      return "n/a";
    }
    return await location.evaluate((el) => el.textContent);
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
    return await bio.evaluate((el) => el.textContent);
  })();

  const bioPromise = (async () => {
    const bioText = await bioTextPromise;
    const parsedBioText = bioText.trim().toLowerCase();
    data.bio = parsedBioText;

    const bioMatchesKeywords = searchTextForKeywords(bioText, generalKeywords);
    data.bioMatchesKeywords = bioMatchesKeywords;

    return parsedBioText;
  })();

  const readmePromise = (async () => {
    const readmeElement = await page.$(
      "article.markdown-body.entry-content.container-lg.f5"
    );
    if (!readmeElement) {
      return;
    }
    const readMe = await readmeElement.evaluate((el) => el.textContent);
    data.isUserReadmeKeywordMatch = searchTextForKeywords(
      readMe,
      generalKeywords
    );
  })();

  const contributionsPromise = (async () => {
    const contributionsElement = await page.$(
      ".js-yearly-contributions > div > h2"
    );
    if (!contributionsElement) {
      data.contributionCount = 0;
      return;
    }
    const contributionCount = await contributionsElement.evaluate(
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
    const companyText = await company.evaluate((el) => el.textContent);
    data.company = companyText.trim().split(/\s+/).join(" ");
  })();

  const companyIsOrgPromise = (async () => {
    const companyIsOrg = await getHrefFromAnchor(page, ".p-org > div > a");
    if (companyIsOrg) {
      data.userCompanyIsOrg = true;
    }
  })();

  await Promise.all([
    readmePromise,
    contributionsPromise,
    followersPromise,
    followingPromise,
    companyPromise,
    companyIsOrgPromise,
    namePromise,
    usernamePromise,
    emailPromise,
    bioPromise,
    locationPromise,
  ]);

  // we only care about scraping a user's organzations and repos if they are in new york
  // or if the queue size is too low
  const queueSize = await db.collection("queue").countDocuments(); // use estimatedDocumentCount() instead?
  if (data.isInNewYork || queueSize < 50) {
    const enqueueOrgsPromise = (async () => {
      const orgs = await page.$$(
        ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a[data-hovercard-type ='organization']"
      );
      if (!orgs) {
        return;
      }
      const orgsToQueue = orgs.slice(0, 5); // only scrape 5 orgs at most
      const queuePromises = orgsToQueue.map(async (org) => {
        const url = await org.evaluate((el) => el.href);
        const orgData = await db.collection("orgs").findOne({ url });
        if (orgData) {
          await updateUserOrg(orgData, db, data.username);
          return;
        }
        if (await db.collection("queue").findOne({ "task.args.0": url })) {
          return;
        }
        await queueTaskdb(
          db,
          {
            type: "org",
            parentType: "user",
            parentId: data.username,
          },
          {
            fn: "scrapeOrganization",
            args: [url],
          }
        );
        data.queuedTasks++;
      });
      await Promise.all(queuePromises);
    })();

    const enqueueReposPromise = (async () => {
      const events = await getEvents(data.username);
      const pullRequestRepoUrls = searchEventsForPullRequests(events);
      const queuePromises = pullRequestRepoUrls.map(async (url) => {
        const repoData = await db.collection("repos").findOne({ url });
        if (repoData) {
          await updateUserRepo(repoData, db, data.username);
          return;
        }
        if (await db.collection("queue").findOne({ "task.args.0": url })) {
          return;
        }
        await queueTaskdb(
          db,
          {
            type: "repo",
            parentType: "user",
            parentId: data.username,
          },
          {
            fn: "scrapeRepo",
            args: [url],
          }
        );
      });
      data.queuedTasks++;
      await Promise.all(queuePromises);
    })();
    await Promise.all([enqueueOrgsPromise, enqueueReposPromise]);
  }
  return data;
};
