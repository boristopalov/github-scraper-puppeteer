import {
  checkIfOrgScraped,
  checkIfRepoScraped,
  checkIfUserScraped,
} from "./checkIfScraped.js";
import { mongoClient } from "../dbConnect.js";
import { DB_ENV } from "../../constants/constants.js";

const checkIfFullyScraped = async () => {
  if (process.argv.length < 4) {
    console.log(
      "Error- please provide a type ('repo', 'user', or 'org') and URL"
    );
    process.exit(1);
  }
  const client = await mongoClient();
  const db = DB_ENV === "testing" ? client.db("testing") : client.db("scraper");
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
};

checkIfFullyScraped();
