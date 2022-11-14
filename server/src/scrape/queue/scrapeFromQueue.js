import { queueTaskdb } from "./queueTask.js";
import { scrapeOrganization } from "../orgs/scrapeOrganization.js";
import { scrapeRepo } from "../repos/scrapeRepo.js";
import {
  incrementTaskCounter,
  decrementTaskCounter,
} from "../../utils/taskCounter.js";
import { scrapeUserProfile } from "../users/scrapeUser.js";
import { writeToClient } from "../../index.js";

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
    data = await scrapeOrganization(db, inFront, res, ...args);
  }
  if (fn === "scrapeRepo") {
    data = await scrapeRepo(db, inFront, res, ...args);
  }
  if (fn === "scrapeUserProfile") {
    data = await scrapeUserProfile(db, inFront, res, ...args);
  }
  decrementTaskCounter();
  try {
    await db.collection("queue").deleteOne({ _id: id });
    if (!data) {
      await queueTaskdb(db, context, task, inFront); //re-queue if scraping fails, which would result in data being null
      return;
    }

    if (type === "repo" && parentType === "org") {
      await updateOrgWithRepoData(data, db, parentId);
    }
    if (type === "repo" && parentType === "user") {
      await updateUserWithRepoData(data, db, parentId);
    }
    if (type === "user" && parentType === "repo") {
      await updateRepoWithUserData(data, db, parentId);
    }
    if (type === "org") {
      await updateOrgMembers(data, db);
    }
    return;
  } catch (e) {
    writeToClient(res, e.message);
  }
};

const updateRepoWithUserData = async (data, db, parentId) => {
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

const updateOrgWithRepoData = async (data, db, parentId) => {
  const updatedDoc = {
    $set: {
      updatedAt: Date.now(),
    },
    $pull: {
      queuedTasks: data.url,
    },
    $inc: {
      numRepoReadmeKeywordMatch: data.isRepoReadmeKeywordMatch ? 1 : 0,
    },
  };
  await db.collection("orgs").findOneAndUpdate({ url: parentId }, updatedDoc);
};

const updateUserWithRepoData = async (data, db, parentId) => {
  const updatedDoc = {
    $set: {
      updatedAt: Date.now(),
    },
    $pull: {
      queuedTasks: data.url,
    },
    $inc: {
      numContributedReposWithHundredStars: data.repoStarCount >= 100 ? 1 : 0,
      numContributedReposWithReadmeKeywordMatch: data.isRepoReadmeKeywordMatch
        ? 1
        : 0,
    },
  };
  await db.collection("users").updateOne({ url: parentId }, updatedDoc);
};

const updateOrgMembers = async (data, db) => {
  const updatedDoc = {
    $set: {
      updatedAt: Date.now(),
    },
    $pull: {
      queuedTasks: data.url,
    },
    $inc: {
      numOrgBioKeywordMatch: data.bioKeywordMatch ? 1 : 0,
      numOrgReposWithHundredStars: data.numReposWithHundredStars,
    },
  };
  await db
    .collection("users")
    .updateMany({ url: { $in: data.members } }, updatedDoc);
};
