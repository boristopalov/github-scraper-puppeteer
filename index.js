const puppeteer = require("puppeteer");
const fs = require("fs");
const {
  arrayOfObjectsToCSV,
  calculateWeightedCandidateScore,
  getFilteredBio,
  getFilteredLocation,
  searchTextForKeywords,
  searchEventsForEmail,
} = require("./utils");
const { getEvents } = require("./api");
const keywords = require("./keywords");

const scrape = async (url, callback) => {
  let data = [];
  let pageCount = 1;

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);
  scrape: while (true) {
    const users = await page.$$(".d-table-cell.col-9.v-align-top.pr-3");
    for await (const user of users) {
      let userData = {};
      // name is always displayed; if there is no name a blank element is displayed
      const name = await user.$(".f4.Link--primary");

      const nameText = await (
        await name.getProperty("textContent")
      ).jsonValue();
      userData["name"] = nameText !== "" ? nameText : "n/a";

      // username is always displayed
      const username = await user.$(".Link--secondary");
      const usernameText = await (
        await username.getProperty("textContent")
      ).jsonValue();
      userData["username"] = usernameText;

      // scraping user's public emails with the github REST API, **not** Puppeteer.
      const events = await getEvents(usernameText);
      const email = await searchEventsForEmail(events, usernameText, nameText);
      if (!email) {
        break scrape;
      }
      userData["email"] = email;

      const popularRemoCommits = await searchEventsForPopularCommits(
        usernameText
      );

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
        keywords.generalKeywords
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

  callback(data);
  await browser.close();
};

// launches a new instance of puppeteer to run in parallel with the rest of the scraping process
const scrapeUser = async (url) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);

  const contributionCount = await page.$eval(
    ".js-yearly-contributions > div > h2",
    (e) => e.innerText.split(" ")[0]
  );
  const orgs = await page.$$(
    ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a"
  );

  // if user is a member of any organizations, scrape data from each organization
  if (orgs) {
    const orgUrls = orgs.map((org) => org.getProperty("href").jsonValue());
    console.log(orgUrls);
    orgUrls.forEach((url) => scrapeUserOrganization(url));
  }

  console.log(contributionCount);
  await browser.close();
};

const scrapeUserOrganization = async (url) => {
  const page = await browser.newPage();
  // go to organization page and sort repos by number of stars
  await page.goto(url + "?q=&type=all&language=&sort=stargazers");

  const repos = await page.$$(".org-repos.repo-list > div > ul > li");
  const repoStarCountXPath = "a[contains(@href,'stargazers')]";
  for await (const repo of repos) {
    const infoDiv = await repo.$("color-fg-muted.f6");
    const repoStarCount = await repo.$x(repoStarCountXPath);
    console.log(repoStarCount);
  }
};

(async () => {
  const DATAFILE = "./data/data.csv";
  const JSONFILE = "./data/data.json";
  const url = "https://github.com/mikedemarais?page=109&tab=following";

  // if you want to scrape >100 pages you have to manually change the page url and re-run
  // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 100 pages -> re-run with scrape('https://github.com/mikedemarais?page=101&tab=following')
  await scrape(url, (data) => {
    // save data to JSON file
    let jsonStream = fs.createWriteStream(JSONFILE, { flags: "a" });
    jsonStream.write(JSON.stringify(data));
    jsonStream.end();

    // convert data to csv-formatted string and save it to a .csv file
    let dataStream = fs.createWriteStream(DATAFILE, { flags: "a" });
    const csvString = arrayOfObjectsToCSV(data);
    dataStream.write(csvString);
    dataStream.end();
  });

  // didn't use these
  // const keywords = ['web3', 'solidity', 'blockchain', 'crypto', 'ether', 'eth', 'ethereum', 'chain', 'smart contract', 'defi'];
  // const locations = ['nyc', 'new york', 'ny', 'new york city']
  // const bioFilteredData = await utils.getFilteredBio(userFollowingData, keywords);
  // const locationFilteredData = await utils.getFilteredLocation(userFollowingData, locations);
})();
