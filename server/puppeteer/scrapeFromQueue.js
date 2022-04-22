import puppeteer from "puppeteer";

export const scrapeFromQueue = async (queue) => {
  const newTask = queue.shift();

  const { db, type, parentType, id, toInsert } = newTask.context;
  console.log(`Scraping ${id} from the queue!`);
  // no need to update the DB if type is null
  // this is the 2nd case from scrapeRepo.js
  if (type === null) {
    await newTask.runTask(newTask.context.url, db, newTask.context.data, queue);
    return;
  }
  if (type === "repo" && parentType === "org") {
    // i think we have to relaunch here because
    // it's possible that the puppeteer instance
    // from the parent task was terminated.
    const browser = await puppeteer.launch({ headless: false });
    const repoPage = await browser.newPage();
    // grab the url from the object we are inserting into DB
    await repoPage.goto(toInsert.url);

    // run the task
    const data = await newTask.runTask(browser, repoPage, db, queue);

    // collect the data we need to update in the DB
    let numReposWithHundredStars = 0;
    let numRepoReadmeKeywordMatch = 0;
    await db.collection("scraped_repos").insertOne(toInsert);
    if (data.repoStarCount >= 100) {
      numReposWithHundredStars++;
    }
    if (data.isRepoReadmeKeywordMatch) {
      numRepoReadmeKeywordMatch++;
    }

    // update the DB
    const updatedDoc = {
      $set: {
        numRepoReadmeKeywordMatch: numRepoReadmeKeywordMatch,
        numReposWithHundredStars: numReposWithHundredStars,
      },
    };
    await db.collection("orgs").updateOne({ name: id }, updatedDoc);
  }
  if (type === "repo" && parentType === "user") {
    const browser = await puppeteer.launch({ headless: false });
    const repoPage = await browser.newPage();
    await repoPage.goto(newTask.context.repoUrl);

    // run the task
    const data = await newTask.runTask(browser, repoPage, db, queue);

    // collect the data we need to update in the DB
    let numPullRequestReposWithHundredStars = 0;
    let numPullRequestReposWithReadmeKeywordMatch = 0;
    await db.collection("scraped_users").insertOne(toInsert);
    if (data.repoStarCount >= 100) {
      numPullRequestReposWithHundredStars++;
    }
    if (data.isRepoReadmeKeywordMatch) {
      numPullRequestReposWithReadmeKeywordMatch++;
    }

    // update the DB
    const updatedDoc = {
      $set: {
        numPullRequestReposWithReadmeKeywordMatch:
          numPullRequestReposWithReadmeKeywordMatch,
        numPullRequestReposWithHundredStars:
          numPullRequestReposWithHundredStars,
      },
    };
    await db.collection("users").updateOne({ username: id }, updatedDoc);
  }
  if (type === "org" && parentType === "user") {
    const browser = await puppeteer.launch({ headless: false });
    // run the task
    const data = await newTask.runTask(
      browser,
      newTask.context.orgUrl,
      db,
      queue
    );

    // collect the data we need to update in the DB
    let numOrgReposWithHundredStars = 0;
    let numOrgReposReadmeKeywordMatch = 0;
    await db.collection("scraped_orgs").insertOne(toInsert);
    if (data.repoStarCount >= 100) {
      numOrgReposWithHundredStars++;
    }
    if (data.isRepoReadmeKeywordMatch) {
      numOrgReposReadmeKeywordMatch++;
    }

    // update the DB
    const updatedDoc = {
      $set: {
        numOrgReposReadmeKeywordMatch: numOrgReposReadmeKeywordMatch,
        numOrgReposWithHundredStars: numOrgReposWithHundredStars,
      },
    };
    await db.collection("users").updateOne({ username: id }, updatedDoc);
  }
};
