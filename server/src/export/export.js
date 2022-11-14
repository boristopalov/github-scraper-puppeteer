import arrayOfObjectsToCSV from "../utils/arrayOfObjectsToCSV.js";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "url";
import path from "path";

export const exportRepo = async (db, url) => {
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    console.error("No repo with that URL found");
    return null;
  }

  const contributors = Object.keys(repo.contributors);
  const toExport = await db
    .collection("users")
    .find(
      {
        $and: [
          { queuedTasks: { $size: 0 } },
          { exported: false },
          { username: { $in: contributors } },
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
  console.log("toExport", toExport);
  const csvString = arrayOfObjectsToCSV(toExport);
  const date = Date.now();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const writePath = path.resolve(
    __dirname + `../../../data/scraped_users_${date}.csv`
  );

  try {
    await fs.writeFile(writePath, csvString);
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
          { username: { $in: contributors } },
        ],
      },
      updatedDoc
    );
    console.log(`Wrote to ${writePath}`);
    return writePath;
  } catch (e) {
    console.error(e);
    return null;
  }
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
  const contributorsToUpdate = [];
  for (const url of reposInOrg) {
    const repo = await db.collection("repos").findOne({ url });
    if (!repo) {
      console.log(`no repo with ${url} found`);
      continue;
    }
    console.log(`repo found with ${url}`);
    const contributors = Object.keys(repo.contributors);
    contributorsToUpdate.push(contributors);
    const toExport = await db
      .collection("users")
      .find(
        {
          $and: [
            { queuedTasks: { $size: 0 } },
            { exported: false },
            { username: { $in: contributors } },
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
  }
  console.log(fullCsvString);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const writePath = path.resolve(
    __dirname + `../../../data/scraped_users_${date}.csv`
  );
  try {
    await fs.writeFile(writePath, fullCsvString);
    console.log(`Wrote to ${writePath}`);
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

          { username: { $in: contributorsToUpdate } },
        ],
      },
      updatedDoc
    );
    return writePath;
  } catch (e) {
    console.error(e);
  }
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

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const writePath = path.resolve(
    __dirname + `../../../data/scraped_users_${date}.csv`
  );

  try {
    await fs.writeFile(writePath, csvString);

    const updatedDoc = {
      $set: {
        exported: true,
        updatedAt: date,
      },
    };
    await db.collection("users").updateOne(
      {
        $and: [
          { queuedTasks: { $size: 0 } },
          { exported: false },
          { url: url },
        ],
      },
      updatedDoc
    );

    console.log(`Wrote to ${writePath}`);
    return writePath;
  } catch (e) {
    console.error(e);
    return null;
  }
};
