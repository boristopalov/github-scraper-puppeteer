import arrayOfObjectsToCSV from "../arrayOfObjectsToCSV.js";
import fs from "fs";

export const exportRepo = async (db, url) => {
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    console.error("No repo with that URL found");
    process.exit(1);
  }
  const contributors = repo.contributors;
  const toExport = await db
    .collection("users")
    .find(
      {
        $and: [
          { queuedTasks: 0 },
          { exported: false },
          { githubUrl: { $in: contributors } },
        ],
      },
      { _id: 0, repoCommits: 0, queuedTasks: 0, exported: 0, createdAt: 0 }
    )
    .toArray();
  // console.log(toExport);
  const csvString = arrayOfObjectsToCSV(toExport);
  const date = Date.now();
  const writePath = `../data/scraped_users_${date}.csv`;

  fs.writeFile(writePath, csvString, async (e) => {
    if (e) {
      console.error(e);
      process.exit(1);
    }
  });
  const updatedDoc = {
    $set: {
      exported: true,
      updatedAt: date,
    },
  };

  await db.collection("users").updateMany(
    {
      $and: [
        { queuedTasks: 0 },
        { exported: false },
        { githubUrl: { $in: contributors } },
      ],
    },
    updatedDoc
  );
  console.log(`Wrote to ${writePath}`);
  return writePath;
};

export const exportOrg = async (db, url) => {
  const org = await db.collection("orgs").findOne({ url });
  const date = Date.now();
  if (!org) {
    console.error("No record(s) with that URL found");
  }
  const reposInOrg = org.reposInOrg;
  let fullCsvString = "";
  for (const url of reposInOrg) {
    const repo = await db.collection("repos").findOne({ url });
    if (!repo) {
      console.log(`no repo with ${url} found`);
      continue;
    }
    const contributors = repo.contributors;
    const toExport = await db
      .collection("users")
      .find(
        {
          $and: [
            { queuedTasks: 0 },
            { exported: false },
            { githubUrl: { $in: contributors } },
          ],
        },
        { _id: 0, repoCommits: 0, queuedTasks: 0, exported: 0, createdAt: 0 }
      )
      .toArray();
    const repoCsvString = arrayOfObjectsToCSV(toExport);
    fullCsvString += repoCsvString;
    const updatedDoc = {
      $set: {
        exported: true,
        updatedAt: date,
      },
    };
    await db.collection("users").updateMany(
      {
        $and: [
          { queuedTasks: 0 },
          { exported: false },
          { githubUrl: { $in: contributors } },
        ],
      },
      updatedDoc
    );
  }
  const writePath = `../data/scraped_users_${date}.csv`;
  fs.writeFile(writePath, fullCsvString, async (e) => {
    if (e) {
      console.error(e);
    }
  });
  console.log(`Wrote to ${writePath}`);
  return writePath;
};

export const exportUser = async (db, url) => {
  const user = await db.collection("users").findOne({ githubUrl: url });
  if (!user) {
    console.error("No record(s) with that URL found");
    process.exit(1);
  }
  const toExport = [user];
  const csvString = arrayOfObjectsToCSV(toExport);
  const date = Date.now();

  const writePath = `../data/scraped_users_${date}.csv`;
  fs.writeFile(writePath, csvString, async (e) => {
    if (e) {
      console.error(e);
    }
  });

  const updatedDoc = {
    $set: {
      exported: true,
      updatedAt: date,
    },
  };
  await db.collection("users").updateOne(
    {
      $and: [{ queuedTasks: 0 }, { exported: false }, { githubUrl: url }],
    },
    updatedDoc
  );

  console.log(`Wrote to ${writePath}`);
  return writePath;
};
