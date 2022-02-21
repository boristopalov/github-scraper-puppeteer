import puppeteer from "puppeteer";
import axios from "axios";
import { scrapeUserProfile } from "./scrapeUserProfile.js";
import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
const TOKEN = process.env.TOKEN;

const ghSearch = async (query, type, db) => {
  // add in options for users or repos or other types
  // error handling ?
  const url = `https://api.github.com/search/${type}?q=${query}`;
  const res = await axios
    .get(url, {
      headers: {
        Authorization: `token ${TOKEN}`,
        "Content-Type": "application/json",
      },
    })
    .catch((error) => console.log(error.message));
  if (res.data) {
    const data = res.data;
    // console.log(data);
    for (const item of data.items) {
      const userUrl = item.html_url;
      const username = item.login;
      if (
        !(await db.collection("scraped_users").findOne({ username: username }))
      ) {
        await db.collection("scraped_users").insertOne({ username: username });
        console.log(`${username} not found in DB, scraping the user...`);
        await scrapeUserProfile(userUrl, true, db);
        // puppeteerData.push(puppeteerUserData);
        // console.log(puppeteerData);
      }
    }
    console.log("all done!");
    return;
    // return puppeteerData;
  } else {
    console.log("no users to scrape!");
    return;
  }
};

dotenv.config();
dbUser = process.env.DB_USER;
dbPass = process.env.DB_PASS;

const uri = `mongodb+srv://${dbUser}:${dbPass}@ghscraper.eyaht.mongodb.net/GHScraper?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
client.connect(async (err) => {
  if (err) {
    console.log(err);
  }
  const db = client.db("scraper");
  await ghSearch("peloton", "users", db);
  await browser.close();
  // saveData(res);
  await client.close();
});
