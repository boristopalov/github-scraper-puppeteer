import sleep from "../../utils/sleep.js";
import puppeteer from "puppeteer";
import checkForBotDetection from "../checkForBotDetection.js";

export const scrapeUserProfileRepos = async (url) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--incognito", "--disable-breakpad"],
  });
  try {
    const pages = await browser.pages();
    const page = pages[0];
    await checkForBotDetection(page);

    await page.goto(url);
    await navigateToRepos(page);
    const repos = await page.$$(".col-10.col-lg-9.d-inline-block");

    let tenStarRepoCount = 0;

    for (const repo of repos) {
      const starElement = await repo.$(".f6.color-fg-muted.mt-2 > a");
      if (!starElement) {
        continue;
      }
      const starCount = await page.evaluate(
        (e) => parseInt(e.innerText),
        starElement
      );
      if (starCount > 10) {
        tenStarRepoCount++;
      }
    }
    return tenStarRepoCount;
  } finally {
    await browser.close();
  }
};

const navigateToRepos = async (page) => {
  await page.waitForSelector("[data-tab-item='repositories']");
  const reposTabAnchor = await page.$("[data-tab-item='repositories']");
  await reposTabAnchor.click();
  const noRepos = await page.$(".blankslate-heading");
  if (noRepos) {
    return;
  }
  await page.waitForSelector(
    ".width-full > .d-flex > .d-flex > #type-options > .btn"
  );
  await page.click(".width-full > .d-flex > .d-flex > #type-options > .btn");

  await page.waitForSelector(
    "#type-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(2)"
  );
  await page.click(
    "#type-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(2)"
  );

  await sleep(500);

  await page.waitForSelector(
    ".width-full > .d-flex > .d-flex > #sort-options > .btn"
  );
  await page.click(".width-full > .d-flex > .d-flex > #sort-options > .btn");

  await page.waitForSelector(
    "#sort-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
  );
  await page.click(
    "#sort-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
  );

  await sleep(500);
};
