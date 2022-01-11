const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://github.com/boristopalov/github-scraper-puppeteer");

  const repoSelector = ".Counter.js-social-count";
  await page.waitForSelector(repoSelector);
  const repoStarCount = await page.$eval(repoSelector, (e) => e.innerText);
  console.log(repoStarCount);
})();
