import arrayOfObjectsToCSV from "../utils/arrayOfObjectsToCSV.js";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const projection = Object.freeze({
  _id: 0,
  repoCommits: 0,
  queuedTasks: 0,
  exported: 0,
  createdAt: 0,
});

export const exportCSV = async (db, type, url, unexportedOnly) => {
  try {
    url = url.toLowerCase();
    const unexportedOnlyQuery = unexportedOnly ? { exported: false } : {};
    if (url === "") {
      return exportAllUsers(db, unexportedOnlyQuery);
    } else if (type === "org") {
      return exportOrg(db, url, unexportedOnlyQuery);
    } else if (type === "repo") {
      return exportRepo(db, url, unexportedOnlyQuery);
    } else if (type === "user") {
      return exportUser(db, url, unexportedOnlyQuery);
    }
    return null;
  } catch (e) {
    console.log(e);
    return null;
  }
};

export const exportRepo = async (db, url, unexportedOnlyQuery) => {
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    console.error("No repo with that URL found");
    return null;
  }
  const contributors = Object.keys(repo.contributors);
  const fullQuery = {
    $or: [
      {
        $and: [{ username: { $in: contributors } }, { isInNewYork: true }],
      },
      {
        $and: [
          { queuedTasks: { $size: 0 } },
          { username: { $in: contributors } },
          unexportedOnlyQuery,
        ],
      },
    ],
  };

  const toExport = await db
    .collection("users")
    .find(fullQuery, { projection })
    .toArray();

  console.log("toExport", toExport);
  const csvString = arrayOfObjectsToCSV(toExport);
  const date = Date.now();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const writePath = path.resolve(
    __dirname + `../../../data/scraped_users_${date}.csv`
  );

  await fs.writeFile(writePath, csvString);

  const updatedDoc = {
    $set: {
      exported: true,
      updatedAt: date,
    },
  };
  await db.collection("users").updateMany(fullQuery, updatedDoc);

  console.log(`Wrote to ${writePath}`);
  return writePath;
};

export const exportOrg = async (db, url, unexportedOnlyQuery) => {
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
          $or: [
            {
              $and: [
                { username: { $in: contributors } },
                { isInNewYork: true },
              ],
            },
            {
              $and: [
                { queuedTasks: { $size: 0 } },
                unexportedOnlyQuery,
                { username: { $in: contributors } },
              ],
            },
          ],
        },
        { projection }
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
      $or: [
        {
          $and: [
            { username: { $in: contributorsToUpdate } },
            { isInNewYork: true },
          ],
        },
        {
          $and: [
            { queuedTasks: { $size: 0 } },
            unexportedOnlyQuery,
            { username: { $in: contributorsToUpdate } },
          ],
        },
      ],
    },
    updatedDoc
  );
  return writePath;
};

export const exportUser = async (db, url, unexportedOnlyQuery) => {
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
        $and: [unexportedOnlyQuery, { url }],
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

export const exportAllUsers = async (db, unexportedOnlyQuery) => {
  const date = Date.now();

  const query = {
    $or: [
      { isInNewYork: true },
      {
        $and: [{ queuedTasks: { $size: 0 } }, unexportedOnlyQuery],
      },
    ],
  };

  const toExport = await db
    .collection("users")
    .find(query, { projection })
    .toArray();

  const csvString = arrayOfObjectsToCSV(toExport);
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
        $and: [{ queuedTasks: { $size: 0 } }, unexportedOnlyQuery],
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
