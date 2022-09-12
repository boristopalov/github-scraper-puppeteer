import sleep from "../../utils/sleep.js";
import puppeteer from "puppeteer";
import checkForBotDetection from "../../utils/checkForBotDetection.js";

export const scrapeUserProfileRepos = async (url) => {
  let tries = 2;
  while (tries > 0) {
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--incognito"],
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
    } catch (e) {
      console.error(e.stack);
      console.error("Error occured for:", url);
      tries--;
    } finally {
      // https://github.com/puppeteer/puppeteer/issues/298#issuecomment-771671297
      await browser.close();
    }
  }
  return 0;
};

const navigateToRepos = async (page) => {
  await page.waitForSelector("[data-tab-item='repositories']");
  const reposTabAnchor = await page.$("[data-tab-item='repositories']");
  await reposTabAnchor.click();
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
