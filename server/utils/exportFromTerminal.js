import { mongoClient } from "./dbConnect.js";
import { exec } from "child_process";
import { csvExport } from "./csvExport.js";

const exportRepo = async (db, url) => {
  const toExport = await db
    .collection("users")
    .find({ repoCommits: url })
    .toArray();
  if (!toExport || toExport.length === 0) {
    console.error("No record(s) with that URL found");
    process.exit(1);
  }
  const urls = toExport.map((e) => e.url);
  const date = Date.now();

  const command = `mongoexport --config='./exportConfig.yaml' --collection='users' --type='csv' --fields='username,name,email,location,isInNewYork,bio,bioMatchesKeywords,githubUrl,numPullRequestReposWithHundredStars,numPullRequestReposWithReadmeKeywordMatch,contributionCount,tenStarRepoCount,isUserReadmeKeywordMatch,company,userCompanyIsOrg,githubFollowers,githubFollowing,numOrgBioKeywordMatch,numOrgReposWithHundredStars,numOrgReposReadmeKeywordMatch' --query='{"$and": [{"queuedTasks": 0 }, {"exported": false}, {"url": {$in: ${urls}}} ]}' --out='data/scraped_users_${date}.csv'`;
  exec(
    command,

    async (err, stdout, stderr) => {
      if (err) {
        // node couldn't execute the command
        console.error(err.stack);
        process.exit(1);
      }
      // the *entire* stdout and stderr (buffered)
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      const updatedDoc = {
        $set: {
          exported: true,
          updatedAt: new Date(),
        },
      };
      await db.collection("users").updateMany(
        {
          $and: [
            { queuedTasks: 0 },
            { exported: false },
            { url: { $in: urls } },
          ],
        },
        updatedDoc
      );
    }
  );
};

const exportOrg = async (db, url) => {
  const org = await db.collection("orgs").findOne({ url });
  if (!org) {
    console.error("No record(s) with that URL found");
    process.exit(1);
  }
  const reposInOrg = org.reposInOrg;
  const toExport = await db
    .collection("users")
    .find({ repoCommits: { $in: reposInOrg } })
    .toArray();
  const urls = toExport.map((e) => e.url);
  const date = Date.now();

  const command = `mongoexport --config='./exportConfig.yaml' --collection='users' --type='csv' --fields='username,name,email,location,isInNewYork,bio,bioMatchesKeywords,githubUrl,numPullRequestReposWithHundredStars,numPullRequestReposWithReadmeKeywordMatch,contributionCount,tenStarRepoCount,isUserReadmeKeywordMatch,company,userCompanyIsOrg,githubFollowers,githubFollowing,numOrgBioKeywordMatch,numOrgReposWithHundredStars,numOrgReposReadmeKeywordMatch' --query='{"$and": [{"queuedTasks": 0 }, {"exported": false}, {"url": {$in: ${urls}}} ]}' --out='data/scraped_users_${date}.csv'`;
  exec(
    command,

    async (err, stdout, stderr) => {
      if (err) {
        // node couldn't execute the command
        console.error(err.stack);
        process.exit(1);
      }
      // the *entire* stdout and stderr (buffered)
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      const updatedDoc = {
        $set: {
          exported: true,
          updatedAt: new Date(),
        },
      };
      await db.collection("users").updateMany(
        {
          $and: [
            { queuedTasks: 0 },
            { exported: false },
            { url: { $in: urls } },
          ],
        },
        updatedDoc
      );
    }
  );
};

const exportUser = async (db, _url) => {
  const user = await db.collection("users").findOne({ _url });
  if (!user) {
    console.error("No record(s) with that URL found");
    process.exit(1);
  }
  const url = user.url;
  const date = Date.now();

  const command = `mongoexport --config='./exportConfig.yaml' --collection='users' --type='csv' --fields='username,name,email,location,isInNewYork,bio,bioMatchesKeywords,githubUrl,numPullRequestReposWithHundredStars,numPullRequestReposWithReadmeKeywordMatch,contributionCount,tenStarRepoCount,isUserReadmeKeywordMatch,company,userCompanyIsOrg,githubFollowers,githubFollowing,numOrgBioKeywordMatch,numOrgReposWithHundredStars,numOrgReposReadmeKeywordMatch' --query='{"$and": [{"queuedTasks": 0 }, {"exported": false}, {"url": ${url}} ]}' --out='data/scraped_users_${date}.csv'`;
  exec(
    command,

    async (err, stdout, stderr) => {
      if (err) {
        // node couldn't execute the command
        console.error(err.stack);
        process.exit(1);
      }
      // the *entire* stdout and stderr (buffered)
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      const updatedDoc = {
        $set: {
          exported: true,
          updatedAt: new Date(),
        },
      };
      await db.collection("users").updateMany(
        {
          $and: [{ queuedTasks: 0 }, { exported: false }, { url: url }],
        },
        updatedDoc
      );
    }
  );
};

const exportFromTerminal = async () => {
  try {
    const client = await mongoClient();
    const db = client.db("scraper");
    if (process.argv.length === 2) {
      csvExport(db);
      return;
    } else if (process.argv.length < 4) {
      console.error("Usage: yarn export ['repo' | 'org' | 'user'] [URL]");
      process.exit(1);
    }
    const type = process.argv[2];
    const url = process.argv[3];
    if (type === "repo") {
      exportRepo(db, url);
    } else if (type === "org") {
      exportOrg(db, url);
    } else if (type === "user") {
      exportUser(db, url);
    } else {
      console.error("Possible types are: 'repo', 'org', or 'user'");
      process.exit(1);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

exportFromTerminal();
