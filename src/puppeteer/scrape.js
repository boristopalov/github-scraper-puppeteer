import { launch } from "puppeteer";
import { searchEventsForPullRequests } from "../searchEventsForPullRequests";
import { searchEventsForEmail } from "../searchEventsForEmail";
import { searchTextForKeywords } from "../searchTextForKeywords";
import { getEvents } from "../api/getEvents";
import { generalKeywords } from "../keywords";

const scrape = async (url) => {
  let data = [];
  let pageCount = 1;

  const browser = await launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);
  scrape: while (true) {
    // array of divs with information on a user
    const users = await page.$$(".d-table-cell.col-9.v-align-top.pr-3");
    for await (const user of users) {
      let userData = {};

      // name is always displayed; if there is no name a blank element is displayed
      const name = await user.$(".f4.Link--primary");

      const nameText = await (
        await name.getProperty("textContent")
      ).jsonValue();
      userData["name"] = nameText !== "" ? nameText : "n/a";

      const username = await user.$(".Link--secondary");
      const usernameText = await (
        await username.getProperty("textContent")
      ).jsonValue();
      // username is always displayed so we don't have to check if it exists
      userData["username"] = usernameText;

      // getEvents() uses the github REST API, **not** Puppeteer.
      const events = await getEvents(usernameText);

      // searchEventsForEmail() returns null if the API request doesn't go through
      // maybe we don't want to break if the request doesn't work though?
      const email = await searchEventsForEmail(events, usernameText, nameText);
      if (!email) {
        break scrape;
      }
      userData["email"] = email;

      const pullRequests = searchEventsForPullRequests(usernameText);

      // not always displayed -- the below element doesn't exist if there is no work info for a user
      // therefore we have to check if it exists
      const company = await user.$("p.color-fg-muted.text-small.mb-0 > span");
      let companyText = work
        ? await (await work.getProperty("textContent")).jsonValue()
        : "n/a";
      companyText = companyText.trim();
      let workArr = companyText.split(/\s+/);
      companyText = workArr.join(" ");
      userData["company"] = await companyText;

      // location not always displayed
      const location = await user.$("p.color-fg-muted.text-small.mb-0");
      let locationText = location
        ? await (await location.getProperty("textContent")).jsonValue()
        : "n/a";
      locationText = locationText.trim();
      let locationArr = locationText.split(/\s+/);

      // work-around to get rid of work text, sometimes the data retrieval is iffy
      locationArr = locationArr.filter((e) => !workArr.includes(e));
      locationText = locationArr.length ? locationArr.join(" ") : "n/a";
      locationText = locationText.toLowerCase();

      // Looks for users with "new york" or "nyc" and filters out germany since it contains the string "ny"
      // there are other strings containing "ny" but they rarely pop up for a user's location
      const isInNewYork =
        searchTextForKeywords(locationText, ["new york", "ny"]) &&
        !searchTextForKeywords(locationText, ["germany"]);
      if (isInNewYork) {
        // scrape the user's profile
        const url = await (
          await (
            await user.$("a.d-inline-block.no-underline.mb-1")
          ).getProperty("href")
        ).jsonValue();
        await scrapeUser(userData, url);
      }

      userData["location"] = locationText;

      // bio not always displayed
      const bio = await user.$(".color-fg-muted.text-small.mb-2");
      let bioText = bio
        ? await (await bio.getProperty("textContent")).jsonValue()
        : "n/a";
      bioText = await bioText.trim().toLowerCase();
      userData["bio"] = await bioText;

      // search for keywords in bio
      const bioMatchesKeywords = searchTextForKeywords(
        bioText,
        generalKeywords
      );

      data.push(userData);
    }
    console.log("Page scraped: ", pageCount++);
    const paginationContainer = await page.$(".pagination");

    // check if we are on the the last page
    if (!paginationContainer) {
      console.log("No more pages to scrape! Exiting...");
      break;
    }
    const nextButtonXpath = "a[contains(text(),'Next')]";
    let nextButton = await paginationContainer.$x(nextButtonXpath);
    if (!nextButton[0]) {
      console.log("No more pages to scrape! Exiting...");
      break;
    }

    await nextButton[0].click();
    await page.waitForNavigation();
  }

  await browser.close();
  return new Promise((resolve) => resolve(userData));
};
const _scrape = scrape;
export { _scrape as scrape };

// launches a new instance of puppeteer to run in parallel with the rest of the scraping process
// const scrapeUser = async (url) => {
//   const browser = await launch({ headless: false });
//   const page = await browser.newPage();
//   await page.goto(url);

//   const contributionCount = await page.$eval(
//     ".js-yearly-contributions > div > h2",
//     (e) => e.innerText.split(" ")[0]
//   );
//   const orgs = await page.$$(
//     ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a"
//   );

//   // if user is a member of any organizations, scrape data from each organization
//   if (orgs) {
//     const orgUrls = orgs.map((org) => org.getProperty("href").jsonValue());
//     console.log(orgUrls);
//     orgUrls.forEach((url) => scrapeUserOrganization(url));
//   }

//   console.log(contributionCount);
//   await browser.close();
// };
// const scrapeUserOrganization = async (url) => {
//   const page = await browser.newPage();
//   // go to organization page and sort repos by number of stars
//   await page.goto(url + "?q=&type=all&language=&sort=stargazers");

//   const repos = await page.$$(".org-repos.repo-list > div > ul > li");
//   const repoStarCountXPath = "a[contains(@href,'stargazers')]";
//   for await (const repo of repos) {
//     const infoDiv = await repo.$("color-fg-muted.f6");
//     const repoStarCount = await repo.$x(repoStarCountXPath);
//     console.log(repoStarCount);
//   }
// };
