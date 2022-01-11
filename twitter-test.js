const puppeteer = require("puppeteer");

const getTwitterFollowers = async (url) => {
  const browser = await puppeteer.launch({ headless: false });

  const twitterPage = await browser.newPage();
  await twitterPage.goto(url);

  const followerSelector =
    "#react-root > div > div > div.css-1dbjc4n.r-18u37iz.r-13qz1uu.r-417010 > main > div > div > div > div.css-1dbjc4n.r-kemksi.r-1kqtdi0.r-1ljd8xs.r-13l2t4g.r-1phboty.r-1jgb5lz.r-11wrixw.r-61z16t.r-1ye8kvj.r-13qz1uu.r-184en5c > div > div:nth-child(2) > div > div > div:nth-child(1) > div > div.css-1dbjc4n.r-13awgt0.r-18u37iz.r-1w6e6rj > div:nth-child(2) > a > span.css-901oao.css-16my406.r-1fmj7o5.r-poiln3.r-b88u0q.r-bcqeeo.r-qvutc0 > span";

  await twitterPage.waitForSelector(followerSelector);
  const elements = await twitterPage.$eval(
    followerSelector,
    (e) => e.innerText
  );
  // const followers = twitterPage.evaluate()
  console.log(elements);
};

getTwitterFollowers("https://twitter.com/m1guelpf");
