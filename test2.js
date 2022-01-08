const puppeteer = require("puppeteer");
const { getHrefFromAnchor } = require("./utils");

const orgTest = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // go to organization page and sort repos by number of stars
  await page.goto("https://github.com/m1guelpf");

  //   const twitterElement = await page.$("[itemprop='twitter'] > a");
  const twitterUrl = await getHrefFromAnchor(page, "[itemprop='twitter'] > a");
  if (twitterUrl) {
    const twitterPage = await browser.newPage();
    await twitterPage.goto(twitterUrl);
    console.log(twitterUrl);
    const followerSelector = "#react-root > div > div > div.css-1dbjc4n.r-18u37iz.r-13qz1uu.r-417010 > main > div > div > div > div.css-1dbjc4n.r-kemksi.r-1kqtdi0.r-1ljd8xs.r-13l2t4g.r-1phboty.r-1jgb5lz.r-11wrixw.r-61z16t.r-1ye8kvj.r-13qz1uu.r-184en5c > div > div:nth-child(2) > div > div > div:nth-child(1) > div.css-1dbjc4n.r-1ifxtd0.r-ymttw5.r-ttdzmv > div.css-1dbjc4n.r-13awgt0.r-18u37iz.r-1w6e6rj > div:nth-child(2) > a > span.css-901oao.css-16my406.r-1fmj7o5.r-poiln3.r-b88u0q.r-bcqeeo.r-qvutc0 > span";
    // const followers = await page.$('#react-root > div > div > div.css-1dbjc4n.r-18u37iz.r-13qz1uu.r-417010 > main > div > div > div > div.css-1dbjc4n.r-kemksi.r-1kqtdi0.r-1ljd8xs.r-13l2t4g.r-1phboty.r-1jgb5lz.r-11wrixw.r-61z16t.r-1ye8kvj.r-13qz1uu.r-184en5c > div > div:nth-child(2) > div > div > div:nth-child(1) > div.css-1dbjc4n.r-1ifxtd0.r-ymttw5.r-ttdzmv > div.css-1dbjc4n.r-13awgt0.r-18u37iz.r-1w6e6rj > div:nth-child(2) > a > span.css-901oao.css-16my406.r-9ilb82.r-poiln3.r-bcqeeo.r-qvutc0 > span');
    await twitterPage.waitForSelector(followerSelector);
    const followers = await page.$(followerSelector)
    console.log(followers)
    
  }
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
