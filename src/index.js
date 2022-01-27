import fs from "fs";
import { scrape } from "./puppeteer/scrape.js";
import arrayOfObjectsToCSV from "./utils/arrayOfObjectsToCSV.js";

const main = async () => {
  const DATAFILE = "../data/data-test.csv";
  const JSONFILE = "../data/data-test.json";
  const url = "https://github.com/mikedemarais?page=101&tab=following";

  // if you want to scrape >100 pages you have to manually change the page url and re-run
  // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 100 pages -> re-run with scrape('https://github.com/mikedemarais?page=101&tab=following')
  const data = await scrape(url);

  // save data to JSON file
  let jsonStream = fs.createWriteStream(JSONFILE, { flags: "a" });
  jsonStream.write(JSON.stringify(data));
  jsonStream.end();

  // convert data to csv-formatted string and save it to a .csv file
  let dataStream = fs.createWriteStream(DATAFILE, { flags: "a" });
  const csvString = arrayOfObjectsToCSV(data);
  dataStream.write(csvString);
  dataStream.end();
  return;
};

// didn't use these
// const keywords = ['web3', 'solidity', 'blockchain', 'crypto', 'ether', 'eth', 'ethereum', 'chain', 'smart contract', 'defi'];
// const locations = ['nyc', 'new york', 'ny', 'new york city']
// const bioFilteredData = await utils.getFilteredBio(userFollowingData, keywords);
// const locationFilteredData = await utils.getFilteredLocation(userFollowingData, locations);

main();
