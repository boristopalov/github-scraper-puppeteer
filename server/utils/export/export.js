import { exec } from "child_process";

export const exportRepo = async (db, url) => {
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
  return `scraped_users_${date}.csv`;
};

export const exportOrg = async (db, url) => {
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
  return `scraped_users_${date}.csv`;
};

export const exportUser = async (db, _url) => {
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
  return `scraped_users_${date}.csv`;
};
