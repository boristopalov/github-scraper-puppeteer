export const scrapeOrgRepo = async (repoPage) => {
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
  }
  const repoStarCount = repoPage.$eval(
    ".Counter.js-social-count",
    (e) => e.innerText
  );
  // console.log(repoStarCount);
  return new Promise((resolve, reject) => {
    resolve(repoStarCount);
  });
};
