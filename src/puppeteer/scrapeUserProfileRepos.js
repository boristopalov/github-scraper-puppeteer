export const scrapeUserProfileRepos = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector(".col-10.col-lg-9.d-inline-block");
  const repos = await page.$$(".col-10.col-lg-9.d-inline-block");

  let tenStarRepoCount = 0;
  for (const repo of repos) {
    const starElement = await repo.$(".f6.color-fg-muted.mt-2 > a");
    // console.log(starElement)
    if (starElement) {
      let starCount = await page.evaluate(
        (e) => parseInt(e.innerText),
        starElement
      );
      if (starCount > 10) tenStarRepoCount++;
    }
  }
  await page.close();
  return new Promise((resolve) => resolve(tenStarRepoCount));
};
