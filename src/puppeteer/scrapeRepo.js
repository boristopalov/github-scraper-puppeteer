import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { readmeKeywords } from "../keywords.js";
import sleep from "../utils/sleep.js";

export const scrapeRepo = async (repoPage) => {
  const data = {
    repoStarCount: 0,
    isRepoReadmeKeywordMatch: false,
  };

  await sleep(1000);
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
  await repoPage.close();
  return new Promise((resolve) => {
    resolve(data);
  });
};
