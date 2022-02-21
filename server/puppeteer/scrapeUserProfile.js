import puppeteer, { BrowserContext } from "puppeteer";
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
import fs from "fs";

// scrapes README keyword matches, contribution count, follower count, twitter followers, and orgs
export const scrapeUserProfile = async (url, isIndividualScrape, db = null) => {
  let data = {
    contributionCount: 0,
    tenStarRepoCount: 0,
    isUserReadmeKeywordMatch: false,
    userCompanyIsOrg: false,
    githubFollowers: 0,
    githubFollowing: 0,
    twitterFollowers: "n/a",
    numOrgBioKeywordMatch: 0,
    numOrgReposWithHundredStars: 0,
    numOrgReposReadmeKeywordMatch: 0,
    company: "n/a",
    location: "n/a",
    isInNewYork: false, // done
    githubUrl: "n/a", // done
  };

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await checkForBotDetection(page);
  await sleep(1000);

  const reposPage = await browser.newPage();
  await reposPage.goto(url);
  const tenStarRepoCount = await scrapeUserProfileRepos(reposPage);
  // await reposPage.close();
  data.tenStarRepoCount = tenStarRepoCount;

  // if user has a readme, search for keywords in readme
  try {
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

    // checks if they have a twitter
    // const twitterUrl = await getHrefFromAnchor(
    //   page,
    //   "[itemprop='twitter'] > a"
    // );
    // if (twitterUrl !== null) {
    //   const twitterFollowers = await scrapeTwitterFollowers(
    //     twitterUrl,
    //     browser
    //   );
    //   data.twitterFollowers = twitterFollowers;
    // }

    let orgs = await page.$$(
      ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a[data-hovercard-type ='organization']"
    );

    // if user is a member of any organizations, scrape data from each organization
    if (orgs) {
      if (orgs.length > 5) {
        orgs = orgs.slice(0, 5);
      }
      // console.log(orgs);

      // fs.readFile("../../data/scraped-orgs.json", async (e, content) => {
      // const scrapedOrgs = JSON.parse(content);
      const orgUrls = await Promise.all(
        orgs.map((org) =>
          org.getProperty("href").then((res) => res.jsonValue())
        )
      );
      if (isInNewYork) {
        for (const url of orgUrls) {
          if (!(await db.collection("scraped_orgs").findOne({ url: url }))) {
            await db.collection("scraped_orgs").insertOne({ url: url });
            const orgBrowser = await puppeteer.launch({ headless: true });
            const orgData = await scrapeOrganization(orgBrowser, url, db);
            if (orgData.bioKeywordMatch) {
              data.numOrgBioKeywordMatch++;
            }
            data.numOrgReposReadmeKeywordMatch +=
              orgData.numRepoReadmeKeywordMatch;
            data.numOrgReposWithHundredStars +=
              orgData.numReposWithHundredStars;
            await orgBrowser.close();
          }
        }
      }
      if (isIndividualScrape) {
        data = {
          name: "n/a", // done
          email: "n/a", // done ?
          username: "n/a", // done
          bio: "n/a", // done
          bioMatchesKeywords: false, // done
          numPullRequestReposWithHundredStars: 0, // done
          numPullRequestReposWithReadmeKeywordMatch: 0, // done
          ...data,
        };
        try {
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

          // searchEventsForEmail() returns null if the API request doesn't go through
          // we don't want to keep scraping if we run out of API requests
          // maybe we don't want to break if the request doesn't work though?
          if (!email) {
            return;
          }
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

          const pullRequestRepoUrls = searchEventsForPullRequests(events);
          for (const url of pullRequestRepoUrls) {
            if (!(await db.collection("scraped_repos").findOne({ url: url }))) {
              await db.collection("scraped_repos").insertOne({ url: url });
              const page = await browser.newPage();
              await page.goto(url);
              // const repoName = url.split("/")[4];
              const repoData = await scrapeRepo(page, db);
              if (repoData.repoStarCount >= 100) {
                data.numPullRequestReposWithHundredStars++;
              }
              if (repoData.isRepoReadmeKeywordMatch) {
                data.numPullRequestReposWithReadmeKeywordMatch++;
              }
            }
          }

          if (!(await db.collection("users").findOne({ username: username }))) {
            await db.collection("users").insertOne(data);
          }
          await browser.close();
          return new Promise((resolve) => resolve(data));
        } catch (e) {
          console.log(e.message);
          await browser.close();
          return new Promise((resolve) => resolve(data));
        }
      }
    }

    await browser.close();
    return new Promise((resolve) => resolve(data));
  } catch (e) {
    console.log(e.message);
    await browser.close();
    return new Promise((resolve) => resolve(data));
  }
};

// scrapeUserProfile("https://github.com/da-bao-jian");
