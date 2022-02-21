import sleep from "../utils/sleep.js";
export const scrapeUserProfileRepos = async (page) => {
  // const sources = await page.$("#type_source");
  // console.log(sources);
  // await sources.click();
  // const sortStargazers = await page.$("#sort_stargazers");
  // await sortStargazers.click();

  try {
    await sleep(1000);
    await page.waitForSelector("[data-tab-item='repositories']");
    const reposTabAnchor = await page.$("[data-tab-item='repositories']");
    await reposTabAnchor.click();

    await page.waitForSelector(
      ".width-full > .d-flex > .d-flex > #type-options > .btn"
    );
    await page.click(".width-full > .d-flex > .d-flex > #type-options > .btn");

    await page.waitForSelector(
      "#type-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(2)"
    );
    await page.click(
      "#type-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(2)"
    );

    await sleep(500);

    await page.waitForSelector(
      ".width-full > .d-flex > .d-flex > #sort-options > .btn"
    );
    await page.click(".width-full > .d-flex > .d-flex > #sort-options > .btn");

    await page.waitForSelector(
      "#sort-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
    );
    await page.click(
      "#sort-options > .SelectMenu > .SelectMenu-modal > .SelectMenu-list > .SelectMenu-item:nth-child(3)"
    );

    await sleep(500);

    // await page.waitForSelector(".col-10.col-lg-9.d-inline-block");
    const repos = await page.$$(".col-10.col-lg-9.d-inline-block");

    let tenStarRepoCount = 0;
    for await (const repo of repos) {
      const starElement = await repo.$(".f6.color-fg-muted.mt-2 > a");
      // console.log(starElement)
      if (starElement) {
        let starCount = await page.evaluate(
          (e) => parseInt(e.innerText),
          starElement
        );
        if (starCount > 10) {
          tenStarRepoCount++;
        }
      }
    }

    await page.close();
    return new Promise((resolve) => resolve(tenStarRepoCount));
  } catch (e) {
    console.log(e.message);
    await page.close();
    return new Promise((resolve) => resolve(0));
  }
};
