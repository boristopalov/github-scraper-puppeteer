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
  const { context, task } = record;
  const inFront = record.inFront || { sendToFront: false, depth: 0 };
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
  const repo = await db.collection("repos").findOne({ name: parentId });
  const queuedTasks = repo.queuedTasks || 1;
  const queuedTasksArray = repo.queuedTasksArray || [];
  const filteredQueuedTasksArray = queuedTasksArray.filter(
    (e) => e !== data.githubUrl
  );

  const updatedDoc = {
    $set: {
      queuedTasks: queuedTasks - 1,
      queuedTasksArray: filteredQueuedTasksArray,
      updatedAt: Date.now(),
    },
  };

  await db.collection("repos").updateOne({ name: parentId }, updatedDoc);
};

export const updateOrgRepo = async (data, db, parentId) => {
  let currentNumReposWithHundredStars = 0;
  let currentNumRepoReadmeKeywordMatch = 0;
  if (data.repoStarCount >= 100) {
    currentNumReposWithHundredStars++;
  }
  if (data.isRepoReadmeKeywordMatch) {
    currentNumRepoReadmeKeywordMatch++;
  }

  const org = await db.collection("orgs").findOne({ name: parentId });
  if (!org) {
    console.log("Unable to find parent with ID", parentId);
    return;
  }
  const numReposWithHundredStars = org.numReposWithHundredStars || 0;
  const numRepoReadmeKeywordMatch = org.numRepoReadmeKeywordMatch || 0;

  // update the DB
  const updatedDoc = {
    $set: {
      numRepoReadmeKeywordMatch:
        currentNumRepoReadmeKeywordMatch + numRepoReadmeKeywordMatch,
      numReposWithHundredStars:
        currentNumReposWithHundredStars + numReposWithHundredStars,
      updatedAt: Date.now(),
    },
  };
  await db.collection("orgs").updateOne({ name: parentId }, updatedDoc);
};

export const updateUserRepo = async (data, db, parentId) => {
  let currentNumPullRequestReposWithHundredStars = 0;
  let currentNumPullRequestReposWithReadmeKeywordMatch = 0;
  if (data.repoStarCount >= 100) {
    currentNumPullRequestReposWithHundredStars++;
  }
  if (data.isRepoReadmeKeywordMatch) {
    currentNumPullRequestReposWithReadmeKeywordMatch++;
  }

  const user = await db.collection("users").findOne({ username: parentId });
  if (!user) {
    console.log("Unable to find parent with ID", parentId);
    return;
  }
  const numPullRequestReposWithHundredStars =
    user.numPullRequestReposWithHundredStars || 0;
  const numPullRequestReposWithReadmeKeywordMatch =
    user.numPullRequestReposWithReadmeKeywordMatch || 0;
  const queuedTasks = user.queuedTasks || 1;
  let queuedTasksArray = user.queuedTasksArray || [];
  if (queuedTasksArray.length > 0) {
    queuedTasksArray = queuedTasksArray.filter((e) => e !== data.url);
  }

  // update the DB
  const updatedDoc = {
    $set: {
      queuedTasks: queuedTasks - 1,
      queuedTasksArray: queuedTasksArray,
      numPullRequestReposWithReadmeKeywordMatch:
        currentNumPullRequestReposWithReadmeKeywordMatch +
        numPullRequestReposWithReadmeKeywordMatch,
      numPullRequestReposWithHundredStars:
        currentNumPullRequestReposWithHundredStars +
        numPullRequestReposWithHundredStars,
      updatedAt: Date.now(),
    },
  };
  await db.collection("users").updateOne({ username: parentId }, updatedDoc);
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
  let queuedTasksArray = user.queuedTasksArray || [];
  if (queuedTasksArray.length > 0) {
    queuedTasksArray = queuedTasksArray.filter((e) => e !== data.url);
  }

  // update the DB
  const updatedDoc = {
    $set: {
      queuedTasks: queuedTasks - 1,
      queuedTasksArray: queuedTasksArray,
      numOrgReposReadmeKeywordMatch:
        currentNumOrgReposReadmeKeywordMatch + numOrgReposReadmeKeywordMatch,
      numOrgReposWithHundredStars:
        currentNumOrgReposWithHundredStars + numOrgReposWithHundredStars,
      numOrgBioKeywordMatch:
        currentNumOrgBioKeywordMatch + numOrgBioKeywordMatch,
      updatedAt: Date.now(),
    },
  };
  await db.collection("users").updateOne({ username: parentId }, updatedDoc);
};
