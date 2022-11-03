import arrayOfObjectsToCSV from "../arrayOfObjectsToCSV.js";
import fs from "fs";

export const exportRepo = async (db, url) => {
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    console.error("No repo with that URL found");
    return null;
  }
  const contributors = repo.contributors;
  const toExport = await db
    .collection("users")
    .find(
      {
        $and: [
          { queuedTasks: { $size: 0 } },
          { exported: false },
          { url: { $in: contributors } },
        ],
      },
      {
        projection: {
          _id: 0,
          repoCommits: 0,
          queuedTasks: 0,
          exported: 0,
          createdAt: 0,
        },
      }
    )
    .toArray();
  const csvString = arrayOfObjectsToCSV(toExport);
  const date = Date.now();
  const writePath = `../data/scraped_users_${date}.csv`;

  fs.writeFile(writePath, csvString, async (e) => {
    if (e) {
      console.error(e);
      return null;
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
        { queuedTasks: { $size: 0 } },
        { exported: false },
        { url: { $in: contributors } },
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
    return null;
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
            { queuedTasks: { $size: 0 } },
            { exported: false },
            { url: { $in: contributors } },
          ],
        },
        {
          projection: {
            _id: 0,
            repoCommits: 0,
            queuedTasks: 0,
            exported: 0,
            createdAt: 0,
          },
        }
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
          { queuedTasks: { $size: 0 } },
          { exported: false },
          { url: { $in: contributors } },
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
  const user = await db.collection("users").findOne({ url });
  if (!user) {
    console.error("No record(s) with that URL found");
    return null;
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
      $and: [{ queuedTasks: { $size: 0 } }, { exported: false }, { url: url }],
    },
    updatedDoc
  );

  console.log(`Wrote to ${writePath}`);
  return writePath;
};
