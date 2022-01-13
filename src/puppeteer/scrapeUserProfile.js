import puppeteer from "puppeteer";
import getHrefFromAnchor from "../utils/getHrefFromAnchor.js";
import searchTextForKeywords from "../utils/searchTextForKeywords.js";
import { generalKeywords } from "../keywords.js";
import { scrapeTwitterFollowers } from "./scrapeTwitterFollowers.js";
import { scrapeOrganization } from "./scrapeOrganization.js";
import convertNumStringToDigits from "../utils/convertNumStringToDigits.js";
import { scrapeUserProfileRepos } from "./scrapeUserProfileRepos.js";

// scrapes README keyword matches, contribution count, follower count, twitter followers, and orgs
export const scrapeUserProfile = async (url) => {
  const data = {
    contributionCount: 0,
    tenStarRepoCount: 0,
    isUserReadmeKeywordMatch: false,
    userCompanyIsOrg: false,
    githubFollowers: 0,
    twitterFollowers: -1,
    numOrgBioKeywordMatch: 0,
    numOrgReposWithHundredStars: 0,
    numOrgReposReadmeKeywordMatch: 0,
  };

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);

  const reposPage = await browser.newPage();
  await reposPage.goto(url);
  const tenStarRepoCount = await scrapeUserProfileRepos(reposPage);

  console.log(tenStarRepoCount);

  // if user has a readme, search for keywords in readme
  const readmeElement = await page.$(
    "article.markdown-body.entry-content.container-lg.f5"
  );
  if (readmeElement) {
    // $eval() crashes puppeteer if it doesn't find the element so we need to check if the element exists first
    const readmeText = await page.evaluate((e) => e.innerText, readmeElement);
    // console.log(readmeText)
    const readmeMatchesKeywords = searchTextForKeywords(
      readmeText,
      generalKeywords
    );

    data.isUserReadmeKeywordMatch = readmeMatchesKeywords;
  }

  const contributionCount = await page.$eval(
    ".js-yearly-contributions > div > h2",
    (e) => e.innerText.split(" ")[0].replace(",", "")
  );

  data.contributionCount = parseInt(contributionCount);

  // get the number of followers a user has
  const followersDiv = await page.$("span.text-bold.color-fg-default");
  if (followersDiv) {
    let followersCountText = await page.evaluate(
      (e) => e.innerText,
      followersDiv
    );
    followersCountText = followersCountText.replace(",", "");
    data.githubFollowers = convertNumStringToDigits(followersCountText);
  }

  const userCompanyIsOrg = await getHrefFromAnchor(page, ".p-org > div > a");
  if (userCompanyIsOrg) {
    data.userCompanyIsOrg = true;
  }

  // checks if they have a twitter
  const twitterUrl = await getHrefFromAnchor(page, "[itemprop='twitter'] > a");
  if (twitterUrl) {
    const twitterFollowers = await scrapeTwitterFollowers(twitterUrl, browser);
    data.twitterFollowers = twitterFollowers;
  }

  let orgs = await page.$$(
    ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a[data-hovercard-type ='organization']"
  );

  // if user is a member of any organizations, scrape data from each organization
  if (orgs) {
    if (orgs.length > 5) {
      orgs = orgs.slice(0, 5);
    }
    // console.log(orgs);
    const orgUrls = await Promise.all(
      orgs.map((org) => org.getProperty("href").then((res) => res.jsonValue()))
    );

    const orgBrowser = await puppeteer.launch({ headless: false });
    const promises = orgUrls.map((url) => scrapeOrganization(orgBrowser, url));
    const results = await Promise.all(promises);
    await orgBrowser.close();
    for (const result of results) {
      if (result.bioKeywordMatch) {
        data.numOrgBioKeywordMatch++;
      }
      data.numOrgReposReadmeKeywordMatch += result.numRepoReadmeKeywordMatch;
      data.numOrgReposWithHundredStars += result.numReposWithHundredStars;
    }
  }

  await browser.close();
  return new Promise((resolve) => resolve(data));
};

scrapeUserProfile("https://github.com/boristopalov");
