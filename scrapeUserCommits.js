import { searchEventsForPullRequests } from "./utils";

export const scrapeUserCommits = async (urls, browser) => {
  let totalStars = 0;
  for (const url of urls) {
    const page = await browser.newPage();
    await page.goto(url);
    const starSelector = ".Counter.js-social-count";
    await page.waitForSelector(starSelector);
    const repoStarCount = await page.$eval(starSelector, (e) => e.innerText);

    if (repoStarCount > 100) {
      totalStars += 100;

      // need to implement the curve here
    } else {
      totalStars += repoStarCount;
    }

    const readmeDiv = await repoPage.$(
      "[data-target='readme-toc.content'] > article"
    );
    if (readmeDiv) {
      const readmeHTMLProperty = await readmeDiv.getProperty("innerHTML");
      const readMeHTMLText = await readmeHTMLProperty.jsonValue();
      const isKeywordMatch = await searchTextForKeywords(
        readMeHTMLText,
        keywords.readmeKeywords
      );
      // console.log(searchTextForKeywords(readMeHTMLText, keywords.readmeKeywords));
      return new Promise((resolve, reject) => {
        resolve({ stars: repoStarCount, isKeywordMatch: isKeywordMatch });
      });
    } else {
      return new Promise((resolve, reject) => {
        resolve({ stars: repoStarCount, isKeywordMatch: null });
      });
    }
  }
};
