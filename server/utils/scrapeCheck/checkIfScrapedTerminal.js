import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import {
  checkIfOrgScraped,
  checkIfRepoScraped,
  checkIfUserScraped,
} from "./checkIfScraped.js";

const checkIfFullyScraped = () => {
  if (process.argv.length < 4) {
    console.log(
      "Error- please provide a type ('repo', 'user', or 'org') and URL"
    );
    process.exit(1);
  }
  dotenv.config({ path: "../.env" });
  const uri = process.env.URI;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const db = client.db("scraper");
    const type = process.argv[2];
    const url = process.argv[3];
    let scraped;
    if (type === "org") {
      scraped = await checkIfOrgScraped(db, url);
    } else if (type === "repo") {
      scraped = await checkIfRepoScraped(db, url);
    } else if (type === "user") {
      scraped = await checkIfUserScraped(db, url);
    } else {
      console.log("only possible types are 'org', 'repo', and 'user'");
      process.exit(1);
    }
    await client.close();
    if (scraped) return true;
    return false;
  });
};

checkIfFullyScraped();
