import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import util from "util";
const _exec = util.promisify(exec);

export const exportAllScrapedUsers = async (db) => {
  // only export users that have 0 queued tasks and have not been exported already

  const date = Date.now();
  const writePath = `../../../data/scraped_users_${date}.csv`;
  const command = `mongoexport --config='${__dirname}/exportConfig.yaml' --collection='users' --type='csv' --fields='username,name,email,location,isInNewYork,bio,bioMatchesKeywords,url,numContributedReposWithHundredStars,numContributedReposWithReadmeKeywordMatch,contributionCount,tenStarRepoCount,isUserReadmeKeywordMatch,company,userCompanyIsOrg,githubFollowers,githubFollowing,numOrgBioKeywordMatch,numOrgReposWithHundredStars' --query='{"$and": [{ "queuedTasks": { "$size": 0 } }, {"exported": false} ]}' --out=${writePath}`;
  const res = await _exec(command);
  console.log(`stdout: ${res.stdout}`);
  console.log(`stderr: ${res.stderr}`);
  const updatedDoc = {
    $set: {
      exported: true,
      updatedAt: Date.now(),
    },
  };

  await db.collection("users").updateMany(
    {
      $and: [{ queuedTasks: { $size: 0 } }, { exported: false }],
    },
    updatedDoc
  );
  return writePath;
};
