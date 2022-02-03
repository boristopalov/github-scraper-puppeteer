import convertNumStringToDigits from "../utils/convertNumStringToDigits.js";
import puppeteer from "puppeteer";
import sleep from "../utils/sleep.js";

export const scrapeTwitterFollowers = async (url, browser) => {
  const twitterPage = await browser.newPage();
  await twitterPage.goto(url);
  console.log("checking twitter for", url);

  const followerSelector =
    ".css-1dbjc4n:nth-child(5) > .css-1dbjc4n:nth-child(2) > .css-4rbku5 > .css-901oao:nth-child(1) > .css-901oao";
  try {
    await sleep(1000);
    const div = await twitterPage.$(followerSelector);
    if (div) {
      let followers = await twitterPage.$eval(
        followerSelector,
        (e) => e.innerText
      );
      followers = convertNumStringToDigits(followers);
      // console.log(followers);
      // await twitterPage.close();
      return new Promise((resolve) => resolve(followers));
    } else {
      return new Promise((resolve) => resolve(-1));
    }
  } catch (e) {
    console.log(e.message);
    await twitterPage.close();
    return new Promise((resolve) => resolve(-1));
  }
};

// const browser = await puppeteer.launch({ headless: false });
// scrapeTwitterFollowers("https://twitter.com/dabaojianghy", browser);
