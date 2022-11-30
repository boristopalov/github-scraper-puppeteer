import puppeteer from "puppeteer";
import searchTextForKeywords from "../../utils/searchTextForKeywords.js";
import { generalKeywords } from "../../constants/keywords.js";
import checkForBotDetection from "../checkForBotDetection.js";
import { queueTaskdb } from "../queue/queueTask.js";
import waitForAndSelect from "../../utils/waitForAndSelect.js";
import { writeToClient } from "../../index.js";
import { stripBackslash } from "../../utils/stripBackslash.js";

export const scrapeOrganization = async (
  db,
  { sendToFront = false, priority = 0 } = {},
  res,
  url
) => {
  url = url.toLowerCase();
  if (await db.collection("orgs").findOne({ url })) {
    console.log("Already scraped", url);
    writeToClient(res, `already scraped ${url}`);
    return {
      alreadyScraped: true,
    };
  }
  let tries = 3;
  while (tries > 0) {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--incognito",
        "--disable-breakpad",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
    });

    try {
      const pages = await browser.pages();
      const page = pages[0];
      await page.goto(`${url}?q=&type=source&language=&sort=stargazers`);
      const data = await tryScrapeOrg(page, db, { sendToFront, priority }, res);
      await db.collection("orgs").insertOne(data);
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

const tryScrapeOrg = async (page, db, { sendToFront, priority }, res) => {
  const data = {
    name: "n/a",
    url: page.url().split("?")[0].toLowerCase(),
    bioKeywordMatch: false,
    numReposWithHundredStars: 0,
    numRepoReadmeKeywordMatch: 0,
    members: [],
    reposInOrg: [],
    queuedTasks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await checkForBotDetection(page, res);

  const header = await waitForAndSelect(
    page,
    ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
  );

  (async () => {
    const name = await header.$eval(".flex-1 > h1", (e) => e.innerText);
    data.name = name;
  })();

  const bioPromise = (async () => {
    const bio = await header.$eval(".flex-1 > div > div", (e) => e.innerText);
    const bioText = bio || "n/a";
    data.orgBio = bioText;
    return bioText;
  })();

  const bioContainsKeywordsPromise = (async () => {
    const bio = await bioPromise;
    if (bio === "n/a") {
      return;
    }
    const bioContainsKeywords = searchTextForKeywords(bio, generalKeywords);
    data.bioKeywordMatch = bioContainsKeywords;
  })();

  const tasksToQueue = [];
  const enqueueRepoPromises = (async () => {
    let repoBlocks = await page.$$(".mb-1.flex-auto");
    repoBlocks = repoBlocks.slice(1, 5);
    repoBlocks.map(async (block) => {
      let url = await block.$eval("a", (e) => e.href);
      url = url.toLowerCase();
      data.reposInOrg.push(url);

      const repoData = await db.collection("repos").findOne({ url });
      if (repoData) {
        if (repoData.repoStarCount >= 100) {
          data.numReposWithHundredStars++;
        }
        if (repoData.isRepoReadmeKeywordMatch) {
          data.numRepoReadmeKeywordMatch++;
        }
        return data;
      }

      if (await db.collection("queue").findOne({ "task.args.0": url })) {
        console.log(`${url} is already in the queue!`);
        return data;
      }

      if (priority < 1) {
        sendToFront = false;
      } else {
        priority--;
      }

      tasksToQueue.push(
        queueTaskdb(
          db,
          {
            type: "repo",
            parentType: "org",
            parentId: data.url,
          },
          {
            fn: "scrapeRepo",
            args: [url],
          },
          { sendToFront, priority }
        )
      );
      data.queuedTasks.push(url);
    });
  })();

  const repoStarsPromise = (async () => {
    const repoStarsBlock = await page.$$(
      ".public.source.d-block > .color-fg-muted.f6"
    );
    for (const block of repoStarsBlock) {
      const stars = await block.$eval("a", (e) => e.innerText);
      const parsedStars = parseInt(stars.replace(",", ""));
      if (parsedStars >= 100) {
        data.numReposWithHundredStars++;
      }
    }
  })();

  await Promise.all([
    bioContainsKeywordsPromise,
    enqueueRepoPromises,
    repoStarsPromise,
  ]);

  const membersPromise = async () => {
    let pageNum = 1;
    const arr = stripBackslash(data.url).split("/");
    const orgUrlName = arr[arr.length - 1];
    let membersUrl = `https://github.com/orgs/${orgUrlName}/people?page=${pageNum}`;
    await page.goto(membersUrl);
    try {
      while (await page.waitForSelector("a.next_page")) {
        await page.waitForSelector(".py-3.css-truncate.pl-3.flex-auto > span");
        const members = await page.$$(
          ".py-3.css-truncate.pl-3.flex-auto > span"
        );
        for (const user of members) {
          const username = await user.evaluate((el) => el.textContent);
          const userUrl = `https://github.com/${username.toLowerCase()}`;
          data.members.push(userUrl);
        }
        pageNum++;
        membersUrl = `https://github.com/orgs/${orgUrlName}/people?page=${pageNum}`;
        await page.goto(membersUrl);
      }
    } catch (e) {
      return;
    }
  };
  await membersPromise();
  await Promise.all(tasksToQueue);
  return data;
};
