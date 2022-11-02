import puppeteer from "puppeteer";
import searchTextForKeywords from "../../utils/searchTextForKeywords.js";
import { readmeKeywords } from "../../constants/keywords.js";
import sleep from "../../utils/sleep.js";
import checkForBotDetection from "../../utils/checkForBotDetection.js";
import convertNumStringToDigits from "../../utils/convertNumStringToDigits.js";
import { queueTaskdb } from "../../utils/queueTask.js";
import waitForAndSelect from "../../utils/waitForAndSelect.js";
import { writeToClient } from "../../index.js";

export const scrapeRepo = async (
  db,
  url,
  { sendToFront = false, depth = 0 } = {},
  res
) => {
  url = url.toLowerCase();
  if (await db.collection("repos").findOne({ url })) {
    console.log("Already scraped", url);
    writeToClient(res, `already scraped ${url}`);
    return null;
  }
  let tries = 2;
  while (tries > 0) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--incognito", "--disable-breakpad"],
    });
    try {
      const pages = await browser.pages();
      const page = pages[0];
      await page.goto(url);
      const data = await tryScrapeRepo(page, db, { sendToFront, depth });
      await db.collection("repos").insertOne(data);
      writeToClient(res, `successfully scraped ${url}`);
      return data;
    } catch (e) {
      writeToClient(res, `failed to scrape ${url}`);
      console.error(e.stack);
      console.error("Error occured for:", url);
      tries--;
    } finally {
      await browser.close();
    }
  }
  return null;
};

const tryScrapeRepo = async (page, db, { sendToFront, depth }) => {
  const url = page.url().toLowerCase();

  const data = {
    name: "n/a",
    url: url,
    repoStarCount: 0,
    isRepoReadmeKeywordMatch: false,
    topLanguage: "n/a",
    contributors: [],
    queuedTasks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await checkForBotDetection(page);
  await sleep(1000);
  await page.setViewport({ width: 1440, height: 796 });

  const splitUrl = url.split("/");
  const repoName = splitUrl[splitUrl.length - 1];
  data.name = repoName;

  const starsPromise = (async () => {
    const starsElement = await waitForAndSelect(
      page,
      ".Counter.js-social-count"
    );
    const starsCount = await starsElement.evaluate((el) => el.title);
    const parsedStarsCount = starsCount.replace(",", "");
    data.repoStarCount = parseInt(parsedStarsCount);
  })();

  const readmePromise = (async () => {
    const readmeElement = await page.$(
      "[data-target='readme-toc.content'] > article"
    );
    if (!readmeElement) {
      return;
    }
    const readmeText = await readmeElement.evaluate((el) => el.innerText);
    const isReadmeKeywordMatch = searchTextForKeywords(
      readmeText,
      readmeKeywords
    );
    data.isRepoReadmeKeywordMatch = isReadmeKeywordMatch;
  })();

  const topLanguagePromise = (async () => {
    const topLanguageHTML = await page.$(
      "a.d-inline-flex.flex-items-center.flex-nowrap.Link--secondary.no-underline.text-small.mr-3"
    );
    if (!topLanguageHTML) {
      data.topLanguage = "n/a";
      return;
    }
    const topLangugeText = await topLanguageHTML.evaluate(
      (el) => el.innerText.split("\n")[0]
    );
    data.topLanguage = topLangugeText;
  })();

  await Promise.all([starsPromise, readmePromise, topLanguagePromise]);

  const contributors = await getContributors(page);
  for (const c of contributors) {
    const contributorCard = await openUserCard(c, page);
    if (contributorCard) {
      const userData = await tryScrapeContributor(
        data,
        c,
        contributorCard,
        db,
        { sendToFront, depth }
      );
      if (userData) {
        data.contributors.push(userData.url);
      }
    }
  }
  return data;
};

const getContributors = async (page) => {
  await page.waitForSelector("#insights-tab");
  await page.click("#insights-tab");

  await page.waitForSelector(
    ".clearfix > .Layout > .Layout-sidebar > .menu > .js-selected-navigation-item:nth-child(2)"
  );
  await page.click(
    ".clearfix > .Layout > .Layout-sidebar > .menu > .js-selected-navigation-item:nth-child(2)"
  );

  await page.waitForSelector("ol.contrib-data.list-style-none");
  return await page.$$("ol.contrib-data.list-style-none > li");
};

const openUserCard = async (contributor, page) => {
  const hoverCard = await contributor.$("a[data-hovercard-type='user']");
  await hoverCard.hover();
  const popupPathOptions = [
    ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--bottom-left",
    ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--bottom-right",
    ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--top-left",
    ".Popover-message.Popover-message--large.Box.color-shadow-large.Popover-message--top-right",
  ];
  for (const path of popupPathOptions) {
    const contributorCard = await waitForAndSelect(page, path);
    if (contributorCard) {
      return contributorCard;
    }
  }
  return null;
};

const tryScrapeContributor = async (
  repoData,
  contributorEl,
  contributorCard,
  db,
  { sendToFront, depth }
) => {
  const usernamePromise = (async () => {
    await sleep(2000);

    const username = await contributorCard.$(
      "a.f5.text-bold.Link--primary.no-underline"
    );
    if (!username) {
      return "n/a";
    }
    return await username.evaluate((el) => el.innerText);
  })();

  const commitsPromise = (async () => {
    const commits = await contributorEl.$eval(
      "span.cmeta > div > a",
      (e) => e.innerText.split(" ")[0]
    );
    const commitsNum = convertNumStringToDigits(commits);
    const obj = {};
    obj[repoData.url] = commitsNum;
    return obj;
  })();

  const username = await usernamePromise;
  // contributor is a bot
  if (username === "n/a") {
    return null;
  }
  const repoCommits = await commitsPromise;
  const commitsArray = [repoCommits];
  const url = `https://github.com/${username}`.toLowerCase();

  const userData = {
    username,
    url,
    repoCommits: commitsArray,
  };

  const user = await db.collection("users").findOne({ url });
  if (user) {
    const updatedDoc = {
      $set: {
        updatedAt: Date.now(),
      },
      $addToSet: {
        repoCommits: repoCommits,
      },
      $inc: {
        numPullRequestReposWithHundredStars:
          repoData.repoStarCount >= 100 ? 1 : 0,
        numPullRequestReposWithReadmeKeywordMatch:
          repoData.isRepoReadmeKeywordMatch ? 1 : 0,
      },
    };
    await db.collection("users").updateOne({ url }, updatedDoc);
    return userData;
  }

  if (await db.collection("queue").findOne({ "task.args.0": url })) {
    return userData;
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
      type: "user",
      parentType: "repo",
      parentId: repoData.url,
    },
    {
      fn: "scrapeUserProfile",
      args: [url, userData],
    },
    { sendToFront, depth } // if this repo was queued by the user, sendToFront will be true. Otherwise false
  );
  repoData.queuedTasks.push(url);
  return userData;
};
