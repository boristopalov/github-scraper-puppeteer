import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

export const checkIfFullyScraped = () => {
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

const checkIfOrgScraped = async (db, url) => {
  const org = await db.collection("orgs").findOne({ url });
  if (!org) {
    console.log(`${url} not found in DB.`);
    return false;
  }
  if (!org.hasOwnProperty("reposInOrg")) {
    console.log(`No repos logged for ${url}`);
    return false;
  }
  for (const repoUrl of org.reposInOrg) {
    const repoScraped = await checkIfRepoScraped(db, repoUrl);
    if (!repoScraped) {
      console.log(
        `${repoUrl} is a repo in ${url} and hasn't been fully scraped yet.`
      );
      return false;
    }
  }
  console.log(`${url} has finished scraping.`);
  return true;
};

const checkIfRepoScraped = async (db, url) => {
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    console.log(`${url} not found in DB.`);
    return false;
  }
  if (!repo.hasOwnProperty("contributors")) {
    console.log(`No contributors logged for ${url}`);
    return false;
  }
  for (const { githubUrl } of repo.contributors) {
    const scraped = await checkIfUserScraped(db, githubUrl);
    if (!scraped) {
      return false;
    }
  }
  console.log(`${url} has finished scraping.`);
  return true;
};

export const checkIfUserScraped = async (db, url) => {
  const user = await db.collection("users").findOne({ githubUrl: url });
  if (!user) {
    console.log(`${url} not found in DB.`);
    return false;
  }
  if (user.hasOwnProperty("queuedTasks") && user.queuedTasks > 0) {
    return false;
  }
  return true;
};

checkIfFullyScraped();
