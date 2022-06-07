import puppeteer from "puppeteer";
import searchTextForKeywords from "../../utils/searchTextForKeywords.js";
import { readmeKeywords, generalKeywords } from "../../keywords.js";
import sleep from "../../utils/sleep.js";
import checkForBotDetection from "../../utils/checkForBotDetection.js";
import convertNumStringToDigits from "../../utils/convertNumStringToDigits.js";
import { scrapeUserProfile } from "../users/scrapeUser.js";
import { getEvents } from "../../api/getEvents.js";
import searchEventsForEmail from "../../utils/searchEventsForEmail.js";
import searchEventsForPullRequests from "../../utils/searchEventsForPullRequests.js";
import { queueTask } from "../../utils/queueTask.js";
import waitForAndSelect from "../../utils/waitForAndSelect.js";

export const scrapeRepo = async (url, db, queue) => {
  // if (await db.collection("scraped_repos").findOne({ url })) {
  //   return null;
  // }
  let tries = 2;
  while (tries > 0) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(url);
    try {
      const data = await tryScrapeRepo(page, db, queue);
      await db.collection("scraped_repos").insertOne({ url });
      await db.collection("repos").insertOne(data);
      return data;
    } catch (e) {
      console.error(e.stack);
      tries--;
    } finally {
      await browser.close();
    }
  }
  return null;
};

const tryScrapeRepo = async (page, db, queue) => {
  const data = {
    name: "n/a",
    url: "n/a",
    repoStarCount: 0,
    isRepoReadmeKeywordMatch: false,
    topLanguage: "n/a",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  // const browser = await puppeteer.launch({ headless: false });
  // const page = await browser.newPage();
  // await page.goto(url);
  await checkForBotDetection(page);
  await sleep(1000);
  await page.setViewport({ width: 1440, height: 796 });

  const url = page.url();
  data.url = url;

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
    const readmeElement = await waitForAndSelect(
      page,
      "[data-target='readme-toc.content'] > article"
    );
    if (readmeElement) {
      const readmeText = await readmeElement.evaluate((el) => el.innerText);
      const isReadmeKeywordMatch = searchTextForKeywords(
        readmeText,
        readmeKeywords
      );
      data.isRepoReadmeKeywordMatch = isReadmeKeywordMatch;
    }
  })();

  const topLanguagePromise = (async () => {
    const topLanguageHTML = await waitForAndSelect(
      page,
      "a.d-inline-flex.flex-items-center.flex-nowrap.Link--secondary.no-underline.text-small.mr-3"
    );
    if (!topLanguageHTML) {
      return "n/a";
    }
    const topLangugeText = await topLanguageHTML.evaluate(
      (el) => el.innerText.split("\n")[0]
    );
    data.topLanguage = topLangugeText;
  })();

  await Promise.all([starsPromise, readmePromise, topLanguagePromise]);

  const contributors = await getContributors(page);
  // console.log(contributors.length);
  for (const c of contributors) {
    const contributorCard = await openUserCard(c, page);
    if (contributorCard) {
      await tryScrapeContributor(repoName, c, contributorCard, queue, db);
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
  repoName,
  contributorEl,
  contributorCard,
  queue,
  db
) => {
  const nameAndUsernamePromise = (async () => {
    await sleep(2000);
    const name = await contributorCard.$(
      "a.f5.text-bold.Link--primary.no-underline"
    );
    const username = await contributorCard.$(
      "a.Link--secondary.no-underline.ml-1"
    );

    let nameText;
    if (!name) {
      nameText = "n/a";
    } else nameText = await name.evaluate((el) => el.innerText);

    // if there is no name, the username is in name element above so we just swap them
    let usernameText;
    if (!username) {
      usernameText = "n/a";
    } else usernameText = await username.evaluate((el) => el.innerText);
    if (usernameText === "n/a") {
      usernameText = nameText;
      nameText = "n/a";
    }
    return [usernameText, nameText];
  })();

  const commitsPromise = (async () => {
    const commits = await contributorEl.$eval(
      "span.cmeta > div > a",
      (e) => e.innerText.split(" ")[0]
    );
    const commitsNum = convertNumStringToDigits(commits);
    const obj = [];
    obj[repoName] = commitsNum;
    return obj;
  })();

  const [username, name] = await nameAndUsernamePromise;
  // if the contributor is a bot there might not be a username
  if (username === "n/a") {
    return;
  }

  const repoCommits = await commitsPromise;
  if (await db.collection("scraped_users").findOne({ username })) {
    const updatedDoc = { $addToSet: { repoCommits } };
    await db.collection("users").updateOne({ username }, updatedDoc);
    return;
  }

  const bioPromise = (async () => {
    const bioElement = await contributorCard.$(".mt-1");
    if (!bioElement) {
      return "n/a";
    }
    const bioTextProperty = await bioElement.evaluate((el) => el.innerText);
    const bioTextValue = bioTextProperty.trim().toLowerCase();
    return bioTextValue;
  })();

  const bioMatchesKeywordsPromise = (async () => {
    const bio = await bioPromise;
    const bioMatchesKeywords = searchTextForKeywords(
      bio.toLowerCase(),
      generalKeywords
    );
    return bioMatchesKeywords;
  })();

  const events = await getEvents(username);
  const emailPromise = (async () => {
    const email = await searchEventsForEmail(events, username, name);
    return email;
  })();

  const locationPromise = (async () => {
    const location = await contributorCard.$(".mt-2.color-fg-muted.text-small");
    if (!location) {
      return "n/a";
    }

    const locationText = await location.evaluate((el) => el.innerText);
    const parsedLocationText = locationText.trim().toLowerCase();

    return parsedLocationText;
  })();

  const isInNewYorkPromise = (async () => {
    const parsedLocationText = await locationPromise;
    return (
      searchTextForKeywords(parsedLocationText, ["new york", "ny"]) &&
      !searchTextForKeywords(parsedLocationText, ["germany", "sunnyvale"])
    );
  })();

  const [bio, bioMatchesKeywords, email, location, isInNewYork] =
    await Promise.all([
      bioPromise,
      bioMatchesKeywordsPromise,
      emailPromise,
      locationPromise,
      isInNewYorkPromise,
    ]);

  const githubUrl = `https://github.com/${username}`;

  const userData = {
    name,
    email,
    username,
    location,
    isInNewYork,
    bio,
    githubUrl,
    bioMatchesKeywords,
    repoCommits,
    numPullRequestReposWithHundredStars: 0,
    numPullRequestReposWithReadmeKeywordMatch: 0,
    queuedTasks: 0,
    exported: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  if (!isInNewYork && queue.length > 50) {
    return userData;
  }

  const dbResults = await db
    .collection("scraped_users")
    .findOne({ url: githubUrl });
  if (dbResults) {
    console.log(`already scraped ${githubUrl}`);
    return;
  }
  queueTask(
    queue,
    {
      db, // not directly updating the DB with this task but we still need to pass in DB for potential dependent tasks to update the DB
      type: "user",
      parentType: null,
      parentId: null,
    },
    () => scrapeUserProfile(githubUrl, db, userData, queue)
  );

  const pullRequestRepoUrls = searchEventsForPullRequests(events);
  const queuePromises = pullRequestRepoUrls.map(async (url) => {
    const dbResults = await db.collection("scraped_repos").findOne({ url });
    if (dbResults) {
      console.log(`already scraped ${url}`);
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
  return userData;
};
