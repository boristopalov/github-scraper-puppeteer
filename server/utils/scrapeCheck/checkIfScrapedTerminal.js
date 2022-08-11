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
  dotenv.config({ path: "../../.env" });
  const uri = process.env.URI;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      return err;
    }
    const db = client.db("scraper");
    const type = process.argv[2];
    const url = process.argv[3];
    if (type === "org") {
      await checkIfOrgScraped(db, url);
    } else if (type === "repo") {
      await checkIfRepoScraped(db, url);
    } else if (type === "user") {
      await checkIfUserScraped(db, url);
    } else {
      console.log("only possible types are 'org', 'repo', and 'user'");
    }
    await client.close();
    return;
  });
};

checkIfFullyScraped();
