const puppeteer = require("puppeteer");
const { getHrefFromAnchor, searchTextForKeywords } = require("./utils");
const keywords = require("./keywords");

const scrapeUser = async (url) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);

  // if user has a readme, search for keywords in readme
  const readmeElement = await page.$(
    "article.markdown-body.entry-content.container-lg.f5"
  );
  // console.log(readmeElement)
  if (readmeElement) {
    // $eval() crashes puppeteer if it doesn't find the element so we need to check if the element exists first
    const readmeText = await page.evaluate((e) => e.innerText, readmeElement);
    // console.log(readmeText)
    const readmeMatchesKeywords = searchTextForKeywords(
      readmeText,
      keywords.generalKeywords
    );
  }

  const contributionCount = await page.$eval(
    ".js-yearly-contributions > div > h2",
    (e) => e.innerText.split(" ")[0]
  );

  // get the number of followers a user has
  const followersDiv = await page.$("span.text-bold.color-fg-default");
  const followersCount = followersDiv ? followersDiv.innerText : 0;

  // checks if they have a twitter
  const twitterUrl = await getHrefFromAnchor(page, "[itemprop='twitter'] > a");
  if (twitterUrl) {
    const twitterPage = await browser.newPage();
    await twitterPage.goto(twitterUrl);
    console.log(twitterUrl);

    // not working
    const followerSelector =
      "#react-root > div > div > div.css-1dbjc4n.r-18u37iz.r-13qz1uu.r-417010 > main > div > div > div > div.css-1dbjc4n.r-kemksi.r-1kqtdi0.r-1ljd8xs.r-13l2t4g.r-1phboty.r-1jgb5lz.r-11wrixw.r-61z16t.r-1ye8kvj.r-13qz1uu.r-184en5c > div > div:nth-child(2) > div > div > div:nth-child(1) > div.css-1dbjc4n.r-1ifxtd0.r-ymttw5.r-ttdzmv > div.css-1dbjc4n.r-13awgt0.r-18u37iz.r-1w6e6rj > div:nth-child(2) > a > span.css-901oao.css-16my406.r-1fmj7o5.r-poiln3.r-b88u0q.r-bcqeeo.r-qvutc0 > span";
    await twitterPage.waitForSelector(followerSelector);
    const followers = await page.$(followerSelector);
    console.log(followers);
  }

  const orgs = await page.$$(
    ".border-top.color-border-muted.pt-3.mt-3.clearfix.hide-sm.hide-md > a"
  );

  // if user is a member of any organizations, scrape data from each organization
  if (orgs) {
    // console.log(orgs);
    const orgUrls = await Promise.all(
      orgs.map((org) => org.getProperty("href").then((res) => res.jsonValue()))
    );

    const userCompanyUrl = await getHrefFromAnchor(
      page,
      ".vcard-detail.pt-1.css-truncate.css-truncate-target.hide-sm.hide-md > span > div > a"
    );

    // company the user works for is also a github org. allot extra weight --> extra weight to user in general or to the specific org?
    if (orgUrls.some((url) => url === userCompanyUrl)) {
      console.log(`${userCompanyUrl} is an organization`);
    }

    let repoStarCount = 0;
    await Promise.all(
      orgUrls.map(async (url) => {
        const orgStars = await scrapeUserOrganization(browser, url);
        repoStarCount += orgStars;
      })
    );
    // console.log(repoStarCount);
  }

  // console.log(contributionCount);
  await browser.close();
};

const scrapeUserOrganization = async (browser, url) => {
  const page = await browser.newPage();
  // go to organization page and sort repos by number of stars
  await page.goto(url + "?q=&type=all&language=&sort=stargazers");

  const header = await page.$(
    ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
  );
  const orgName = await header.$eval(".flex-1 > h1", (e) => e.innerText);
  const orgBio =
    (await header.$eval(".flex-1 > div > div", (e) => e.innerText)) ||
    "no org bio";
  const bioContainsKeywords = searchTextForKeywords(
    orgbio,
    keywords.generalKeywords
  );

  let repos = await page.$$(".org-repos.repo-list > div > ul > li");
  if (repos.length === 0) {
    console.log(`No repos for ${orgName}`);
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  // only look at the top 3 repos
  if (repos.length > 3) {
    repos = repos.slice(0, 3);
  }

  // convert to Promise.all()
  const promises = [];
  for (const repo of repos) {
    const repoUrl = await getHrefFromAnchor(
      repo,
      ".d-flex.flex-justify-between > div > a"
    );
    // console.log(repoUrl);
    const repoPage = await browser.newPage();
    await repoPage.goto(repoUrl);
    promises.push(await scrapeRepo(repoPage));
  }
  Promise.all(promises).then((results) => console.log(results));

  await page.close();
};

const scrapeRepo = async (repoPage) => {
  // scrape the README for keywords
  const readmeDiv = await repoPage.$(
    "[data-target='readme-toc.content'] > article"
  );
  if (readmeDiv) {
    const readmeHTMLProperty = await readmeDiv.getProperty("innerHTML");
    const readMeHTMLText = await readmeHTMLProperty.jsonValue();
    return new Promise((resolve, reject) => {
      resolve(searchTextForKeywords(readMeHTMLText, keywords.readmeKeywords));
    });
    // console.log(searchTextForKeywords(readMeHTMLText, keywords.readmeKeywords));
    // await repoPage.close();
  }
  let repoStarCount = 0;
  const repoStarCount = repoPage.$eval(
    ".Counter.js-social-count",
    (e) => e.innerText
  );
  // console.log(repoStarCount);
  return new Promise((resolve, reject) => {
    resolve(repoStarCount);
  });
};

scrapeUser("https://github.com/m1guelpf");
// console.log(keywords.readmeKeywords);

// const b = puppeteer.launch({headless: false});
