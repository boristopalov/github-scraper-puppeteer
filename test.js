const puppeteer = require("puppeteer");
const { getHrefFromAnchor, searchTextForKeywords } = require('./utils');
const keywords = require("./keywords");


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

  let repos = await page.$$(".org-repos.repo-list > div > ul > li");
  if (repos.length === 0) {
    console.log(`No repos for ${orgName}`);
    return new Promise((resolve, reject) => {
      resolve(0);
    });
  }

  // only look at the top 3 repos
  if (repos.length > 3) {
    repos = repos.slice(0, 3);
  }

  // convert to Promise.all()
  const promises = [];
  for (const repo of repos) {
      promises.push(await scrapeRepo(browser, repo));
  }
  Promise.all(promises).then((results) => console.log(results));

  await page.close();
};


const scrapeRepo = async (browser, repo) => { 
    const repoUrl = await getHrefFromAnchor(
      repo,
      ".d-flex.flex-justify-between > div > a"
    );
    // console.log(repoUrl);
    const repoPage = await browser.newPage();
    await repoPage.goto(repoUrl);

    // scrape the README for keywords
    const readmeDiv = await repoPage.$("[data-target='readme-toc.content'] > article");
    if (readmeDiv) {
        const readmeHTMLProperty = await readmeDiv.getProperty("innerHTML");
        const readMeHTMLText = await readmeHTMLProperty.jsonValue();
        return new Promise((resolve, reject) => {
            resolve(searchTextForKeywords(readMeHTMLText, keywords.readmeKeywords));
        });
        // console.log(searchTextForKeywords(readMeHTMLText, keywords.readmeKeywords));
        // await repoPage.close();
    }

    // const readme = await repoPage.$eval("[data-target='readme-toc.content'] > article", e => e.innerHTML);
    // let repoStarCount = 0;
    // const repoStarCountXPath = "a[contains(@href,'stargazers')]";
    // const infoDiv = await repo.$(".color-fg-muted.f6");
    // const [repoStars] = await infoDiv.$x(repoStarCountXPath);
    // if not found it means there are 0 stars
    // if (repoStars) {
    //   repoStarCount += await page.evaluate(
        // (e) => parseInt(e.innerText.trim()),
        // repoStars
    //   );
    // }
    // console.log(repoStarCount);
    // return new Promise((resolve, reject) => {
    //   resolve(repoStarCount);
    // });
}

scrapeUser("https://github.com/QuentinPerez");
// console.log(keywords.readmeKeywords);

// const b = puppeteer.launch({headless: false});
