import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { readmeKeywords } from "../keywords.js";
import sleep from "../utils/sleep.js";
import checkForBotDetection from "../utils/checkForBotDetection.js";
import convertNumStringToDigits from "../utils/convertNumStringToDigits.js";
import { scrapeUserProfile } from "./scrapeUserProfile.js";
import fs from "fs";

export const scrapeRepo = async (repoPage, db = null) => {
  const data = {
    name: "n/a",
    url: "n/a",
    repoStarCount: 0,
    isRepoReadmeKeywordMatch: false,
    contributors: [],
    topLanguage: "n/a",
  };

  await checkForBotDetection(repoPage);
  await sleep(1000);
  try {
    await repoPage.setViewport({ width: 1440, height: 796 });
    const repoUrl = repoPage.url();
    data.url = repoUrl;

    const splitUrl = repoUrl.split("/");
    data.name = splitUrl[splitUrl.length - 1];
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

    await repoPage.waitForSelector("#insights-tab");
    await repoPage.click("#insights-tab");

    await repoPage.waitForSelector(
      "#repo-content-pjax-container > div > div.Layout-sidebar > nav > a:nth-child(2)"
    );
    await repoPage.click(
      "#repo-content-pjax-container > div > div.Layout-sidebar > nav > a:nth-child(2)"
    );

    const contributorsSelectorLeft =
      "li.contrib-person.float-left.col-6.my-2.pr-2";
    const contributorsSelectorRight =
      "li.contrib-person.float-left.col-6.my-2.pl-2";

    await repoPage.waitForSelector(contributorsSelectorLeft);
    const contributorsLeft = await repoPage.$$(contributorsSelectorLeft);
    const contributorsRight = await repoPage.$$(contributorsSelectorRight);
    const contributors = contributorsLeft.concat(contributorsRight);

    for (const c of contributors) {
      await sleep(1000);
      const username = await c.$eval(
        "a.text-normal[data-hovercard-type='user']",
        (e) => e.innerText
      );
      if (
        !(await db.collection("scraped_users").findOne({ username: username }))
      ) {
        await db.collection("scraped_users").insertOne({ username: username });
        // just get the number
        const commits = await c.$eval(
          "span.cmeta > div > a",
          (e) => e.innerText.split(" ")[0]
        );
        const commitsNum = convertNumStringToDigits(commits);
        const url = `https://github.com/${username}`;
        console.log(`${username} not found in DB, scraping the user...`);
        const userData = await scrapeUserProfile(url, true, db);
        const object = { ...userData, commitsToRepo: commitsNum };
        data.contributors.push(object);
      }
    }

    if (!(await db.collection("repos").findOne({ url: repoUrl }))) {
      await db.collection("repos").insertOne(data);
    }

    await repoPage.close();
    return new Promise((resolve) => {
      resolve(data);
    });
  } catch (e) {
    console.log(e.message);
    await repoPage.close();
    return new Promise((resolve) => resolve(data));
  }
};
