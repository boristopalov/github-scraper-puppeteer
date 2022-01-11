const puppeteer = require("puppeteer");
const { getHrefFromAnchor } = require("./utils");

const orgTest = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // go to organization page and sort repos by number of stars
  await page.goto("https://github.com/m1guelpf");

  //   const twitterElement = await page.$("[itemprop='twitter'] > a");

  // await page.goBack();

  //   const header = await page.$(
  //     ".d-flex.flex-wrap.flex-items-start.flex-md-items-center.my-3"
  //   );
  //   const orgName = await header.$eval(".flex-1 > h1", (e) => e.innerText);
  //   const orgBio =
  //     (await header.$eval(".flex-1 > div > div", (e) => e.innerText)) ||
  //     "no org bio";
  //   console.log(orgBio);
  await browser.close();
};

orgTest();
