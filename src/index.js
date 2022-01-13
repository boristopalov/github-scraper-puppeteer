import { createWriteStream } from "fs";
import {
  arrayOfObjectsToCSV,
  calculateWeightedCandidateScore,
  getFilteredBio,
  getFilteredLocation,
} from "./utils";
import { scrape } from "./puppeteer/scrape";

const main = async () => {
  const DATAFILE = "./data/data.csv";
  const JSONFILE = "./data/data.json";
  const url = "https://github.com/mikedemarais?page=109&tab=following";

  // if you want to scrape >100 pages you have to manually change the page url and re-run
  // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 100 pages -> re-run with scrape('https://github.com/mikedemarais?page=101&tab=following')
  const data = await scrape(url);

  // save data to JSON file
  let jsonStream = createWriteStream(JSONFILE, { flags: "a" });
  jsonStream.write(JSON.stringify(data));
  jsonStream.end();

  // convert data to csv-formatted string and save it to a .csv file
  let dataStream = createWriteStream(DATAFILE, { flags: "a" });
  const csvString = arrayOfObjectsToCSV(data);
  dataStream.write(csvString);
  dataStream.end();
};

// didn't use these
// const keywords = ['web3', 'solidity', 'blockchain', 'crypto', 'ether', 'eth', 'ethereum', 'chain', 'smart contract', 'defi'];
// const locations = ['nyc', 'new york', 'ny', 'new york city']
// const bioFilteredData = await utils.getFilteredBio(userFollowingData, keywords);
// const locationFilteredData = await utils.getFilteredLocation(userFollowingData, locations);

main();
