import puppeteer from "puppeteer";
import searchEventsForPullRequests from "../utils/searchEventsForPullRequests.js";
import searchEventsForEmail from "../utils/searchEventsForEmail.js";
import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { getEvents } from "../api/getEvents.js";
import { generalKeywords } from "../keywords.js";
import { scrapeUserProfile } from "./scrapeUserProfile.js";
import { scrapeRepo } from "./scrapeRepo.js";
import checkForBotDetection from "../utils/checkForBotDetection.js";
import saveData from "../utils/saveData.js";

export const scrape = async (url) => {
  let data = [];
  let pageCount = 1;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await checkForBotDetection(page);
  scrape: while (true) {
    // save data and clear it so duplicates don't get saved
    if (pageCount % 10 == 0) {
      saveData(data);
      data = [];
    }
    // array of divs with information on a user
    const users = await page.$$(".d-table-cell.col-9.v-align-top.pr-3");
    for await (const user of users) {
      let userData = {
        name: "n/a",
        email: "n/a",
        username: "n/a",
        company: "n/a",
        location: "n/a",
        isInNewYork: false,
        bio: "n/a",
        githubUrl: "n/a",
        bioMatchesKeywords: false,
        numPullRequestReposWithHundredStars: 0,
        numPullRequestReposWithReadmeKeywordMatch: 0,
      };

      // name is always displayed; if there is no name a blank element is displayed
      const name = await user.$(".f4.Link--primary");

      const nameText = await (
        await name.getProperty("textContent")
      ).jsonValue();
      userData.name = nameText !== "" ? nameText : "n/a";

      const username = await user.$(".Link--secondary");
      const usernameText = await (
        await username.getProperty("textContent")
      ).jsonValue();
      // username is always displayed so we don't have to check if it exists
      userData.username = usernameText;

      const githubUrl = "https://github.com/" + usernameText;
      userData.githubUrl = githubUrl;

      // getEvents() uses the github REST API, **not** Puppeteer.
      console.log("user: ", usernameText);
      const events = await getEvents(usernameText);
      const email = await searchEventsForEmail(events, usernameText, nameText);

      // searchEventsForEmail() returns null if the API request doesn't go through
      // we don't want to keep scraping if we run out of API requests
      // maybe we don't want to break if the request doesn't work though?
      if (!email) {
        break scrape;
      }
      userData.email = email;

      // not always displayed -- the below element doesn't exist if there is no work info for a user
      // therefore we have to check if it exists
      const company = await user.$("p.color-fg-muted.text-small.mb-0 > span");
      let companyText = company
        ? await (await company.getProperty("textContent")).jsonValue()
        : "n/a";
      companyText = companyText.trim();
      let workArr = companyText.split(/\s+/);
      companyText = workArr.join(" ");
      userData.company = companyText;

      // location not always displayed
      const location = await user.$("p.color-fg-muted.text-small.mb-0");
      let locationText = location
        ? await (await location.getProperty("textContent")).jsonValue()
        : "n/a";
      locationText = locationText.trim();
      let locationArr = locationText.split(/\s+/);

      // work-around to get rid of work text, sometimes the data retrieval is iffy
      locationArr = locationArr.filter((e) => !workArr.includes(e));
      locationText = locationArr.length ? locationArr.join(" ") : "n/a";
      locationText = locationText.toLowerCase();

      userData.location = locationText;
      // Looks for users with "new york" or "nyc" and filters out germany since it contains the string "ny"
      // there are other strings containing "ny" but they rarely pop up for a user's location
      const isInNewYork =
        searchTextForKeywords(locationText, ["new york", "ny"]) &&
        !searchTextForKeywords(locationText, ["germany", "sunnyvale"]);
      if (isInNewYork) {
        userData.isInNewYork = true;

        // search pull request repos
        const pullRequestRepoUrls = searchEventsForPullRequests(events);

        for (const url of pullRequestRepoUrls) {
          const page = await browser.newPage();
          await page.goto(url);
          const repoData = await scrapeRepo(page);
          if (repoData.repoStarCount >= 100) {
            userData.numPullRequestReposWithHundredStars++;
          }
          if (repoData.isRepoReadmeKeywordMatch) {
            userData.numPullRequestReposWithReadmeKeywordMatch++;
          }
        }
        // scrape the user's profile
        const deepUserData = await scrapeUserProfile(githubUrl);
        Object.assign(userData, deepUserData);
      }

      // bio not always displayed
      const bio = await user.$(".color-fg-muted.text-small.mb-2");
      let bioText = bio
        ? await (await bio.getProperty("textContent")).jsonValue()
        : "n/a";
      bioText = bioText.trim().toLowerCase();
      userData.bio = bioText;

      // search for keywords in bio
      const bioMatchesKeywords = searchTextForKeywords(
        bioText,
        generalKeywords
      );

      userData.bioMatchesKeywords = bioMatchesKeywords;

      data.push(userData);
    }
    console.log("Page scraped: ", pageCount++);
    const paginationContainer = await page.$(".pagination");

    // check if we are on the the last page
    if (!paginationContainer) {
      console.log("No more pages to scrape! Exiting...");
      break;
    }
    const nextButtonXpath = "a[contains(text(),'Next')]";
    let nextButton = await paginationContainer.$x(nextButtonXpath);
    if (!nextButton[0]) {
      console.log("No more pages to scrape! Exiting...");
      break;
    }

    await nextButton[0].click();
    await page.waitForNavigation();
  }

  await browser.close();
  return new Promise((resolve) => resolve(data));
};
