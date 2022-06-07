import { incrementTaskCounter, decrementTaskCounter } from "../taskCounter.js";
export const scrapeFromQueue = async (queue) => {
  const { context, task } = queue.shift();
  const { db, type, parentType, parentId } = context;

  incrementTaskCounter();
  // no need to update the DB if type is null so we can stop here
  if (parentType === null) {
    await task();
    decrementTaskCounter();
    return;
  }

  const data = await task();
  if (!data) {
    decrementTaskCounter();
    // this happens if the scraping fails or if we are trying to scrape something that's already been scraped
    return;
  }

  if (type === "repo" && parentType === "org") {
    await updateOrgRepoFromQueue(data, db, parentId);
  }
  if (type === "repo" && parentType === "user") {
    await updateUserRepoFromQueue(data, db, parentId);
  }
  if (type === "org" && parentType === "user") {
    await updateUserOrgFromQueue(data, db, parentId);
  }
  decrementTaskCounter();
};

const updateOrgRepoFromQueue = async (data, db, parentId) => {
  let currentNumReposWithHundredStars = 0;
  let currentNumRepoReadmeKeywordMatch = 0;
  if (data.repoStarCount >= 100) {
    currentNumReposWithHundredStars++;
  }
  if (data.isRepoReadmeKeywordMatch) {
    currentNumRepoReadmeKeywordMatch++;
  }

  const { numReposWithHundredStars, numRepoReadmeKeywordMatch } = await db
    .collection("orgs")
    .findOne({ name: parentId });

  // update the DB
  const updatedDoc = {
    $set: {
      numRepoReadmeKeywordMatch:
        currentNumRepoReadmeKeywordMatch + numRepoReadmeKeywordMatch,
      numReposWithHundredStars:
        currentNumReposWithHundredStars + numReposWithHundredStars,
      updatedAt: new Date(),
    },
  };
  await db.collection("orgs").updateOne({ name: parentId }, updatedDoc);
};

const updateUserRepoFromQueue = async (data, db, parentId) => {
  let currentNumPullRequestReposWithHundredStars = 0;
  let currentNumPullRequestReposWithReadmeKeywordMatch = 0;
  if (data.repoStarCount >= 100) {
    currentNumPullRequestReposWithHundredStars++;
  }
  if (data.isRepoReadmeKeywordMatch) {
    currentNumPullRequestReposWithReadmeKeywordMatch++;
  }

  const {
    numPullRequestReposWithHundredStars,
    numPullRequestReposWithReadmeKeywordMatch,
    queuedTasks,
  } = await db.collection("users").findOne({ username: parentId });

  // update the DB
  const updatedDoc = {
    $set: {
      queuedTasks: queuedTasks - 1,
      numPullRequestReposWithReadmeKeywordMatch:
        currentNumPullRequestReposWithReadmeKeywordMatch +
        numPullRequestReposWithReadmeKeywordMatch,
      numPullRequestReposWithHundredStars:
        currentNumPullRequestReposWithHundredStars +
        numPullRequestReposWithHundredStars,
      updatedAt: new Date(),
    },
  };
  await db.collection("users").updateOne({ username: parentId }, updatedDoc);
};

const updateUserOrgFromQueue = async (data, db, parentId) => {
  let currentNumOrgReposReadmeKeywordMatch = 0;
  let currentNumOrgReposWithHundredStars = 0;
  let currentNumOrgBioKeywordMatch = 0;
  if (data.bioKeywordMatch) {
    currentNumOrgBioKeywordMatch++;
  }
  currentNumOrgReposReadmeKeywordMatch += data.numRepoReadmeKeywordMatch;
  currentNumOrgReposWithHundredStars += data.numReposWithHundredStars;

  let numOrgBioKeywordMatch,
    numOrgReposWithHundredStars,
    numOrgReposReadmeKeywordMatch,
    queuedTasks;
  ({
    numOrgBioKeywordMatch,
    numOrgReposWithHundredStars,
    numOrgReposReadmeKeywordMatch,
    queuedTasks,
  } = await db.collection("users").findOne({ username: parentId }));
  if (!numOrgBioKeywordMatch) {
    numOrgBioKeywordMatch = 0;
  }
  if (!numOrgReposWithHundredStars) {
    numOrgReposWithHundredStars = 0;
  }
  if (!numOrgReposReadmeKeywordMatch) {
    numOrgReposReadmeKeywordMatch = 0;
  }
  if (!queuedTasks) {
    queuedTasks = 0;
  }

  // update the DB
  const updatedDoc = {
    $set: {
      queuedTasks: queuedTasks - 1,
      numOrgReposReadmeKeywordMatch:
        currentNumOrgReposReadmeKeywordMatch + numOrgReposReadmeKeywordMatch,
      numOrgReposWithHundredStars:
        currentNumOrgReposWithHundredStars + numOrgReposWithHundredStars,
      numOrgBioKeywordMatch:
        currentNumOrgBioKeywordMatch + numOrgBioKeywordMatch,
      updatedAt: new Date(),
    },
  };
  await db.collection("users").updateOne({ username: parentId }, updatedDoc);
};
