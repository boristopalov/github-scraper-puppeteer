import { queueTaskdb } from "../../utils/queueTask.js";
import { scrapeOrganization } from "../orgs/scrapeOrganization.js";
import { scrapeRepo } from "../repos/scrapeRepo.js";
import { incrementTaskCounter, decrementTaskCounter } from "../taskCounter.js";
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
    await queueTaskdb(db, context, task, inFront); //re-queue if scraping fails, which would result in data being null
    return;
  }

  if (type === "repo" && parentType === "org") {
    await updateOrgRepo(data, db, parentId);
  }
  if (type === "repo" && parentType === "user") {
    await updateUserRepo(data, db, parentId);
  }
  if (type === "org" && parentType === "user") {
    await updateUserOrg(data, db, parentId);
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
    // only update user if this org has no queued tasks left (i.e. all the repos have been scraped. otherwise we count more than once)
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
    $inc: {
      numPullRequestReposWithReadmeKeywordMatch: data.isRepoReadmeKeywordMatch
        ? 1
        : 0,
      numPullRequestReposWithHundredStars: data.repoStarCount >= 100 ? 1 : 0,
    },
  };
  await db.collection("users").updateOne({ url: parentId }, updatedDoc);
};

export const updateUserOrg = async (data, db, parentId) => {
  let currentNumOrgReposReadmeKeywordMatch = 0;
  let currentNumOrgReposWithHundredStars = 0;
  let currentNumOrgBioKeywordMatch = 0;
  if (data.bioKeywordMatch) {
    currentNumOrgBioKeywordMatch++;
  }
  currentNumOrgReposReadmeKeywordMatch += data.numRepoReadmeKeywordMatch;
  currentNumOrgReposWithHundredStars += data.numReposWithHundredStars;
  const user = await db.collection("users").findOne({ username: parentId });
  if (!user) {
    console.log("Unable to find parent with ID", parentId);
    return;
  }
  const numOrgBioKeywordMatch = user.numOrgBioKeywordMatch || 0;
  const numOrgReposWithHundredStars = user.numOrgReposWithHundredStars || 0;
  const numOrgReposReadmeKeywordMatch = user.numOrgReposReadmeKeywordMatch || 0;
  const queuedTasks = user.queuedTasks || 1;
  const queuedTasksArray = user.queuedTasksArray || [];
  const filteredQueuedTasksArray = queuedTasksArray.filter(
    (e) => e !== data.url
  );

  // update the DB
  const updatedDoc = {
    $set: {
      numOrgReposReadmeKeywordMatch:
        currentNumOrgReposReadmeKeywordMatch + numOrgReposReadmeKeywordMatch,
      numOrgReposWithHundredStars:
        currentNumOrgReposWithHundredStars + numOrgReposWithHundredStars,
      numOrgBioKeywordMatch:
        currentNumOrgBioKeywordMatch + numOrgBioKeywordMatch,
      queuedTasks: queuedTasks - 1,
      queuedTasksArray: filteredQueuedTasksArray,
      updatedAt: Date.now(),
    },
  };
  await db.collection("users").updateOne({ username: parentId }, updatedDoc);
};
