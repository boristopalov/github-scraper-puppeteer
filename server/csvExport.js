import { exec } from "child_process";

export const csvExport = (db) => {
  // only export users that have 0 queued tasks and have not been exported already

  const date = Date.now();
  const command = `mongoexport --config='./exportConfig.yaml' --collection='users' --type='csv' --fields='username,name,email,location,isInNewYork,bio,bioMatchesKeywords,githubUrl,numPullRequestReposWithHundredStars,numPullRequestReposWithReadmeKeywordMatch,contributionCount,tenStarRepoCount,isUserReadmeKeywordMatch,company,userCompanyIsOrg,githubFollowers,githubFollowing,numOrgBioKeywordMatch,numOrgReposWithHundredStars,numOrgReposReadmeKeywordMatch' --query='{"$and": [{"queuedTasks": 0 }, {"exported": false} ]}' --out='data/scraped_users_${date}.csv'`;
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
          $and: [{ queuedTasks: 0 }, { exported: false }],
        },
        updatedDoc
      );
      process.exit(0);
    }
  );
};
