import puppeteer from "puppeteer";
import getHrefFromAnchor from "../utils/getHrefFromAnchor.js";
import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { generalKeywords } from "../keywords.js";
import { scrapeTwitterFollowers } from "./scrapeTwitterFollowers.js";
import { scrapeOrganization } from "./scrapeOrganization.js";
import convertNumStringToDigits from "../utils/convertNumStringToDigits.js";
import { scrapeUserProfileRepos } from "./scrapeUserProfileRepos.js";
import sleep from "../utils/sleep.js";
import checkForBotDetection from "../utils/checkForBotDetection.js";
import searchEventsForEmail from "../utils/searchEventsForEmail.js";
import searchEventsForPullRequests from "../utils/searchEventsForPullRequests.js";
import { getEvents } from "../api/getEvents.js";
import { scrapeRepo } from "./scrapeRepo.js";
import {
  decrementTaskCounter,
  incrementTaskCounter,
  taskCounter,
  TASKLIMIT,
} from "./taskCounter.js";
import { scrapeFromQueue } from "./scrapeFromQueue.js";

export const scrapeUserProfile = async (
  url,
  isStartingScrape = false,
  db,
  dataObj = null,
  queue,
  isFromQueue = false
) => {
  incrementTaskCounter();
  console.log(`${taskCounter} tasks currently.`);
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);
  await checkForBotDetection(page);
  await sleep(1000);
  let data = {
    ...dataObj,
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
  };

  try {
    if (isStartingScrape) {
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
        ...data,
      };
      const name = await page.$eval(
        "span[itemprop='name']",
        (e) => e.innerText
      );
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
      const bioMatchesKeywords = searchTextForKeywords(
        bioText,
        generalKeywords
      );
      data.bioMatchesKeywords = bioMatchesKeywords;

      const company = await page.$("span.p-org");
      let companyText = company
        ? await (await company.getProperty("textContent")).jsonValue()
        : "n/a";
      companyText = companyText.trim();
      let workArr = companyText.split(/\s+/);
      companyText = workArr.join(" ");
      data.company = companyText;

      // location not always displayed
      const location = await page.$("li[itemprop='homeLocation'] > span");
      let locationText = location
        ? await (await location.getProperty("textContent")).jsonValue()
        : "n/a";
      locationText = locationText.trim();
      let locationArr = locationText.split(/\s+/);

      // work-around to get rid of work text, sometimes the data retrieval is iffy
      locationArr = locationArr.filter((e) => !workArr.includes(e));
      locationText = locationArr.length ? locationArr.join(" ") : "n/a";
      locationText = locationText.toLowerCase();
      data.location = locationText;

      const isInNewYork =
        searchTextForKeywords(locationText, ["new york", "ny"]) &&
        !searchTextForKeywords(locationText, ["germany", "sunnyvale"]);

      data.isInNewYork = isInNewYork;
      const pullRequestRepoUrls = searchEventsForPullRequests(events);
      for (const url of pullRequestRepoUrls) {
        if (!(await db.collection("scraped_repos").findOne({ url: url }))) {
          if (taskCounter < TASKLIMIT) {
            await db.collection("scraped_repos").insertOne({ url: url });
            const newPage = await browser.newPage();
            await newPage.goto(url);
            // const repoName = url.split("/")[4];
            const repoData = await scrapeRepo(browser, newPage, db, queue);
            if (repoData.repoStarCount >= 100) {
              data.numPullRequestReposWithHundredStars++;
            }
            if (repoData.isRepoReadmeKeywordMatch) {
              data.numPullRequestReposWithReadmeKeywordMatch++;
            }
          } else {
            console.log(`adding scraping ${url} to the queue...`);
            const taskToQueue = {
              context: {
                db: db,
                type: "repo",
                repoUrl: url,
                parentType: "user",
                parentId: username,
                toInsert: { username: username },
              },
              runTask: async (browser, newPage, db, queue) =>
                await scrapeRepo(browser, newPage, db, queue, true),
            };
            queue.push(taskToQueue);
          }
        }
      }
    }

    const reposPage = await browser.newPage();
    await reposPage.goto(url);
    const tenStarRepoCount = await scrapeUserProfileRepos(reposPage);
    data.tenStarRepoCount = tenStarRepoCount;

    // if user has a readme, search for keywords in readme
    const readmeElement = await page.$(
      "article.markdown-body.entry-content.container-lg.f5"
    );
    if (readmeElement) {
      // $eval() crashes puppeteer if it doesn't find the element so we need to check if the element exists first
      const readmeText = await page.evaluate((e) => e.innerText, readmeElement);
      // console.log(readmeText)
      const readmeMatchesKeywords = searchTextForKeywords(
        readmeText,
        generalKeywords
      );

      data.isUserReadmeKeywordMatch = readmeMatchesKeywords;
    }

    const contributionCount = await page.$eval(
      ".js-yearly-contributions > div > h2",
      (e) => e.innerText.split(" ")[0].replace(",", "")
    );

    data.contributionCount = parseInt(contributionCount);

    // get the number of followers a user has
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
      const following = convertNumStringToDigits(text);
      data.githubFollowing = following;
    }

    const userCompanyIsOrg = await getHrefFromAnchor(page, ".p-org > div > a");
    if (userCompanyIsOrg) {
      data.userCompanyIsOrg = true;
    }

    let orgs = await page.$$(
      ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a[data-hovercard-type ='organization']"
    );

    // if user is a member of any organizations, scrape data from each organization
    if (orgs) {
      if (orgs.length > 5) {
        orgs = orgs.slice(0, 5);
      }
      const orgUrls = await Promise.all(
        orgs.map((org) =>
          org.getProperty("href").then((res) => res.jsonValue())
        )
      );
      for (const url of orgUrls) {
        if (!(await db.collection("scraped_orgs").findOne({ url: url }))) {
          if (taskCounter < TASKLIMIT) {
            await db.collection("scraped_orgs").insertOne({ url: url });
            const orgBrowser = await puppeteer.launch({ headless: false });
            const orgData = await scrapeOrganization(
              orgBrowser,
              url,
              db,
              queue
            );
            if (orgData.bioKeywordMatch) {
              data.numOrgBioKeywordMatch++;
            }
            data.numOrgReposReadmeKeywordMatch +=
              orgData.numRepoReadmeKeywordMatch;
            data.numOrgReposWithHundredStars +=
              orgData.numReposWithHundredStars;
            await orgBrowser.close();
          } else {
            console.log(`adding scraping ${url} to the queue...`);
            const taskToQueue = {
              context: {
                db: db,
                type: "org",
                orgUrl: url,
                parentType: "user",
                parentId: data.username,
                toInsert: { url: url },
              },
              runTask: async (browser, url, db, queue) =>
                await scrapeOrganization(browser, url, db, queue, true),
            };
            queue.push(taskToQueue);
          }
        }
      }
    }
    if (!(await db.collection("users").findOne({ username: data.username }))) {
      await db.collection("users").insertOne(data);
    }
    decrementTaskCounter();
    await browser.close();
    if (!isFromQueue) {
      while (queue.length > 0 && taskCounter < TASKLIMIT) {
        await scrapeFromQueue(queue);
      }
    }
    return data;
  } catch (e) {
    decrementTaskCounter();
    console.log(e.stack);
    await browser.close();
    return data;
  }
};
