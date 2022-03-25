import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { readmeKeywords, generalKeywords } from "../keywords.js";
import sleep from "../utils/sleep.js";
import checkForBotDetection from "../utils/checkForBotDetection.js";
import convertNumStringToDigits from "../utils/convertNumStringToDigits.js";
import { scrapeUserProfile } from "./scrapeUserProfile.js";
import { getEvents } from "../api/getEvents.js";
import searchEventsForEmail from "../utils/searchEventsForEmail.js";
import searchEventsForPullRequests from "../utils/searchEventsForPullRequests.js";

export const scrapeRepo = async (browser, repoPage, db = null) => {
  const data = {
    name: "n/a",
    url: "n/a",
    repoStarCount: 0,
    isRepoReadmeKeywordMatch: false,
    topLanguage: "n/a",
  };

  await checkForBotDetection(repoPage);
  await sleep(1000);
  try {
    await repoPage.setViewport({ width: 1440, height: 796 });
    const repoUrl = repoPage.url();
    data.url = repoUrl;

    const splitUrl = repoUrl.split("/");
    const repoName = splitUrl[splitUrl.length - 1];
    data.name = repoName;
    await repoPage.waitForSelector(".Counter.js-social-count");
    let repoStarCount = await repoPage.$eval(
      ".Counter.js-social-count",
      (e) => e.title
    );
    repoStarCount = repoStarCount.replace(",", "");
    data.repoStarCount = parseInt(repoStarCount);

    // scrape the README for keywords
    const readmeDiv = await repoPage.$(
      "[data-target='readme-toc.content'] > article"
    );
    if (readmeDiv) {
      const readmeHTMLProperty = await readmeDiv.getProperty("innerHTML");
      const readMeHTMLText = await readmeHTMLProperty.jsonValue();
      const isReadmeKeywordMatch = searchTextForKeywords(
        readMeHTMLText,
        readmeKeywords
      );
      data.isRepoReadmeKeywordMatch = isReadmeKeywordMatch;
    }

    const topLanguage = await repoPage.$(
      "a.d-inline-flex.flex-items-center.flex-nowrap.Link--secondary.no-underline.text-small.mr-3"
    );
    if (topLanguage) {
      data.topLanguage = topLanguage.innerText;
    }

    if (!(await db.collection("scraped_repos").findOne({ url: repoUrl }))) {
      await db.collection("scraped_repos").insertOne({ url: repoUrl });
    }

    await repoPage.waitForSelector("#insights-tab");
    await repoPage.click("#insights-tab");

    await repoPage.waitForSelector(
      ".clearfix > .Layout > .Layout-sidebar > .menu > .js-selected-navigation-item:nth-child(2)"
    );
    await repoPage.click(
      ".clearfix > .Layout > .Layout-sidebar > .menu > .js-selected-navigation-item:nth-child(2)"
    );

    await repoPage.waitForSelector("ol.contrib-data.list-style-none");
    const contributors = await repoPage.$$(
      "ol.contrib-data.list-style-none > li"
    );

    for (const c of contributors) {
      const commits = await c.$eval(
        "span.cmeta > div > a",
        (e) => e.innerText.split(" ")[0]
      );
      const commitsNum = convertNumStringToDigits(commits);
      const hoverCard = await c.$("a[data-hovercard-type='user']");
      await hoverCard.hover();
      await sleep(3000);
      const popupPathOptions = [
        ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--bottom-left",
        ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--bottom-right",
        ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--top-left",
        ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--top-right",
      ];
      let popup = null;
      for (const path of popupPathOptions) {
        popup = await repoPage.$(path);
        if (popup) {
          break;
        }
      }
      if (!popup) {
        console.log("wtf");
        continue;
      }

      let name = await popup.$("a.f5.text-bold.Link--primary.no-underline");
      name = name
        ? await (await name.getProperty("innerText")).jsonValue()
        : "n/a";
      let username = await popup.$("a.Link--secondary.no-underline.ml-1");
      // if there is no name, the username is in name element above so we just swap them
      username = username
        ? await (await username.getProperty("innerText")).jsonValue()
        : "n/a";
      if (username === "n/a") {
        username = name;
        name = "n/a";
      }
      if (
        username !== "n/a" &&
        !(await db.collection("scraped_users").findOne({ username: username }))
      ) {
        await db.collection("scraped_users").insertOne({ username: username });
        console.log(`${username} not found in DB, scraping the user...`);

        let bio = await popup.$(".mt-1");
        bio = bio
          ? await (await bio.getProperty("innerText")).jsonValue()
          : "n/a";
        bio = bio.trim().toLowerCase();
        const bioMatchesKeywords = searchTextForKeywords(
          bio.toLowerCase(),
          generalKeywords
        );
        const events = await getEvents(username);
        const email = await searchEventsForEmail(events, username, name);

        let location = await popup.$(".mt-2.color-fg-muted.text-small");
        location = location
          ? await (await location.getProperty("innerText")).jsonValue()
          : "n/a";
        location = location.trim().toLowerCase();
        const isInNewYork =
          searchTextForKeywords(location, ["new york", "ny"]) &&
          !searchTextForKeywords(location, ["germany", "sunnyvale"]);
        const url = `https://github.com/${username}`;
        const userData = {
          name: name,
          email: email,
          username: username,
          location: location,
          isInNewYork: isInNewYork,
          bio: bio,
          githubUrl: url,
          bioMatchesKeywords: bioMatchesKeywords,
          repoCommits: [],
          numPullRequestReposWithHundredStars: 0,
          numPullRequestReposWithReadmeKeywordMatch: 0,
        };
        const repoCommitsObj = {};
        repoCommitsObj[repoName] = commitsNum;
        userData.repoCommits.push(repoCommitsObj);

        // further scrape users if they are in new york, if not then we don't do any further scraping
        // OR if there are less than 5 tabs open, we keep scraping to reduce the chance of running out users to scrape
        // we don't want to do this further scraping for every user because then there would just be way too much
        // data/too many puppeteer sessions open and we might get memory leaks
        const numPages = (await browser.pages()).length;
        if (isInNewYork || numPages <= 5) {
          const pullRequestRepoUrls = searchEventsForPullRequests(events);

          for (const url of pullRequestRepoUrls) {
            if (!(await db.collection("scraped_repos").findOne({ url: url }))) {
              await db.collection("scraped_repos").insertOne({ url: url });
              const newPage = await browser.newPage();
              await newPage.goto(url);
              const repoData = await scrapeRepo(browser, newPage, db);
              if (repoData.repoStarCount >= 100) {
                userData.numPullRequestReposWithHundredStars++;
              }
              if (repoData.isRepoReadmeKeywordMatch) {
                userData.numPullRequestReposWithReadmeKeywordMatch++;
              }
            }
          }
          await scrapeUserProfile(url, false, db, userData);
        } else {
          await db.collection("users").insertOne(userData);
        }
      } else {
        // if we have already scraped the user then append this repo to their repoCommits
        const repoCommitsObj = {};
        repoCommitsObj[repoName] = commitsNum;
        const updatedDoc = { $addToSet: { repoCommits: repoCommitsObj } };
        await db
          .collection("users")
          .updateOne({ username: username }, updatedDoc);
      }
    }

    if (!(await db.collection("repos").findOne({ url: repoUrl }))) {
      await db.collection("repos").insertOne(data);
    }

    await repoPage.close();
    return new Promise((resolve) => resolve(data));
  } catch (e) {
    console.log(e.message);
    await repoPage.close();
    return new Promise((resolve) => resolve(data));
  }
};
