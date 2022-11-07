import { queueTaskdb } from "./queueTask.js";
import { scrapeOrganization } from "../orgs/scrapeOrganization.js";
import { scrapeRepo } from "../repos/scrapeRepo.js";
import {
  incrementTaskCounter,
  decrementTaskCounter,
} from "../../utils/taskCounter.js";
import { scrapeUserProfile } from "../users/scrapeUser.js";

export const scrapeFromQueuedb = async (db, n, res) => {
  if (!db) {
    console.error("Something went wrong- can't access the DB");
    return;
  }

  const recordPromise = await db
    .collection("queue")
    .find()
    .sort({ "inFront.sendToFront": -1, "inFront.depth": -1, _id: 1 }) // tasks manually queued by the user will be in front
    .limit(1)
    .skip(n)
    .toArray(); // grabs the nth record
  const record = recordPromise[0];
  const id = record._id;
  const { context, task, inFront } = record;
  const { type, parentType, parentId } = context;
  const { fn, args } = task;
  console.log(`scraping ${args[0]}`);

  let data;
  incrementTaskCounter();
  if (fn === "scrapeOrganization") {
    data = await scrapeOrganization(db, ...args, inFront, res);
  }
  if (fn === "scrapeRepo") {
    data = await scrapeRepo(db, ...args, inFront, res);
  }
  if (fn === "scrapeUserProfile") {
    data = await scrapeUserProfile(db, ...args, inFront, res);
  }
  decrementTaskCounter();

  await db.collection("queue").deleteOne({ _id: id });
  if (!data) {
    await queueTaskdb(db, context, task, { sendToFront: false, depth: 0 }); //re-queue if scraping fails, which would result in data being null
    return;
  }

  if (type === "repo" && parentType === "org") {
    await updateOrgRepo(data, db, parentId);
  }
  if (type === "repo" && parentType === "user") {
    await updateUserRepo(data, db, parentId);
  }
  if (type === "user" && parentType === "repo") {
    await updateRepo(data, db, parentId);
  }

  return;
};

const updateRepo = async (data, db, parentId) => {
  const updatedDoc = {
    $set: {
      updatedAt: Date.now(),
    },
    $pull: {
      queuedTasks: data.url,
    },
  };
  await db.collection("repos").updateOne({ url: parentId }, updatedDoc);
};

const updateOrgRepo = async (data, db, parentId) => {
  const updatedDoc = {
    $set: {
      updatedAt: Date.now(),
    },
    $pull: {
      queuedTasks: data.url,
    },
    $inc: {
      numReposWithHundredStars: data.repoStarCount >= 100 ? 1 : 0,
      numRepoReadmeKeywordMatch: data.isRepoReadmeKeywordMatch ? 1 : 0,
    },
  };
  const { value: orgData } = await db
    .collection("orgs")
    .findOneAndUpdate({ url: parentId }, updatedDoc, {
      returnDocument: "after",
      projection: {
        url: 1,
        numReposWithHundredStars: 1,
        numRepoReadmeKeywordMatch: 1,
        bioKeywordMatch: 1,
        members: 1,
        queuedTasks: 1,
      },
    });
  if (orgData.queuedTasks.length > 0) {
    // only update user if this org has no queued tasks left (i.e. all the repos have been scraped. otherwise we increment org-related user data more than once)
    return;
  }
  const scrapedMembers = await db
    .collection("users")
    .find({ url: { $in: orgData.members } })
    .toArray();
  for (const { url } of scrapedMembers) {
    await updateUserOrg(orgData, db, url);
  }
};

const updateUserRepo = async (data, db, parentId) => {
  const updatedDoc = {
    $set: {
      updatedAt: Date.now(),
    },
    $pull: {
      queuedTasks: data.url,
    },
  };
  await db.collection("users").updateOne({ url: parentId }, updatedDoc);
};

const updateUserOrg = async (data, db, parentId) => {
  if (data.queuedTasks.length > 0) {
    return;
  }
  const updatedDoc = {
    $set: {
      updatedAt: Date.now(),
    },
    $pull: {
      queuedTasks: data.url,
    },
    $inc: {
      numOrgBioKeywordMatch: data.bioKeywordMatch ? 1 : 0,
      numOrgReposReadmeKeywordMatch: data.numRepoReadmeKeywordMatch,
      numOrgReposWithHundredStars: data.numReposWithHundredStars,
    },
  };
  await db.collection("users").updateOne({ url: parentId }, updatedDoc);
};
