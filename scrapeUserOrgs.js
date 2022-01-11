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
    promises.push(await scrapeUserRepo(repoPage));
  }
  Promise.all(promises).then((results) => console.log(results));

  await page.close();
};
