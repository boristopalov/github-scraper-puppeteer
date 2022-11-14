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
    const reposSortedUrl = `${url}?tab=repositories&q=&type=source&language=&sort=stargazers`;
    await page.goto(reposSortedUrl);
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
