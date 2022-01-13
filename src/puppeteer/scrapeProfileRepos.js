import puppeteer from "puppeteer";

export const scrapeUserRepos = async (url) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(
    url + "?tab=repositories&q=&type=source&language=&sort=stargazers"
  );
  await page.waitForSelector(".col-10.col-lg-9.d-inline-block");
  const repos = await page.$$(".col-10.col-lg-9.d-inline-block");

  let tenStarRepoCount = 0;
  for await (const repo of repos) {
    const starElement = await repo.$(".f6.color-fg-muted.mt-2 > a");
    // console.log(starElement)
    if (starElement) {
      const starCount = await page.evaluate((e) => e.innerText, starElement);
      if (starCount > 10) tenStarRepoCount++;
    }
  }
};

scrapeUserRepos("https://github.com/boristopalov");
