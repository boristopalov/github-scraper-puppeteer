import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { readmeKeywords } from "../keywords.js";
import sleep from "../utils/sleep.js";
import checkForBotDetection from "../utils/checkForBotDetection.js";
import convertNumStringToDigits from "../utils/convertNumStringToDigits.js";

export const scrapeRepo = async (repoPage) => {
  const data = {
    repoStarCount: 0,
    isRepoReadmeKeywordMatch: false,
    contributors: [],
  };

  await checkForBotDetection(repoPage);
  await sleep(1000);
  try {
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

    await repoPage.click("#insights-tab");
    await repoPage.waitForSelector(
      "#repo-content-pjax-container > .Layout > .Layout-sidebar > .menu > .js-selected-navigation-item:nth-child(2)"
    );
    await repoPage.click(
      "#repo-content-pjax-container > .Layout > .Layout-sidebar > .menu > .js-selected-navigation-item:nth-child(2)"
    );

    const contributorsSelector = "li.contrib-person.float-left.col-6.my-2.pr-2";
    await repoPage.waitForSelector(contributorsSelector);
    const contributors = await repoPage.$$(contributorsSelector);
    for (const c of contributors) {
      const username = await c.$eval(
        "a.text-normal[data-hovercard-type='user']",
        (e) => e.innerText
      );
      // just get the number c
      const commits = await c.$eval(
        "span.cmeta > div > a",
        (e) => e.innerText.split(" ")[0]
      );
      const commitsNum = convertNumStringToDigits(commits);
      const object = { username: username, commits: commitsNum };
      data.contributors.push(object);
    }

    await browser.close();
    await repoPage.close();
    return new Promise((resolve) => resolve(data));
  } catch (e) {
    console.log(e.message);
    await repoPage.close();
    return new Promise((resolve) => resolve(data));
  }
};
