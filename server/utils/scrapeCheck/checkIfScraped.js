export const checkIfOrgScraped = async (db, url) => {
  const org = await db.collection("orgs").findOne({ url });
  if (!org) {
    console.log(`${url} not found in DB.`);
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(org, "reposInOrg")) {
    console.log(`No repos logged for ${url}`);
    return false;
  }
  for (const repoUrl of org.reposInOrg) {
    const repoScraped = await checkIfRepoScraped(db, repoUrl);
    if (!repoScraped) {
      console.log(
        `${repoUrl} is a repo in ${url} and hasn't been fully scraped yet.`
      );
      return false;
    }
  }
  console.log(`${url} has finished scraping.`);
  return true;
};

export const checkIfRepoScraped = async (db, url) => {
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    console.log(`${url} not found in DB.`);
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(repo, "contributors")) {
    console.log(`No contributors logged for ${url}`);
    return false;
  }
  for (const { githubUrl } of repo.contributors) {
    const scraped = await checkIfUserScraped(db, githubUrl);
    if (!scraped) {
      return false;
    }
  }
  console.log(`${url} has finished scraping.`);
  return true;
};

export const checkIfUserScraped = async (db, url) => {
  const user = await db.collection("users").findOne({ githubUrl: url });
  if (!user) {
    console.log(`${url} not found in DB.`);
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(user, "queuedTasks") &&
    user.queuedTasks > 0
  ) {
    return false;
  }
  return true;
};
