export const checkIfOrgScraped = async (db, url) => {
  const org = await db.collection("orgs").findOne({ url });
  if (!org) {
    return { url, scraped: false, tasks: null };
  }
  if (org.queuedTasks.length > 0) {
    return { url, scraped: false, tasks: org.queuedTasks };
  }
  for (const repoUrl of org.reposInOrg) {
    const repoScraped = await checkIfRepoScraped(db, repoUrl);
    if (!repoScraped.scraped) {
      return repoScraped;
    }
  }
  return { url, scraped: true, tasks: [] };
};

export const checkIfRepoScraped = async (db, url) => {
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    return { url, scraped: false, tasks: null };
  }
  if (repo.queuedTasks.length > 0) {
    return { url, scraped: false, tasks: repo.queuedTasks };
  }
  for (const url of repo.contributors) {
    const userScraped = await checkIfUserScraped(db, url);
    if (!userScraped.scraped) {
      return userScraped;
    }
  }
  return { url, scraped: true, tasks: [] };
};

export const checkIfUserScraped = async (db, url) => {
  const user = await db.collection("users").findOne({ url });
  if (!user) {
    return { url, scraped: false, tasks: null };
  }
  if (user.queuedTasks.length > 0) {
    return { url, scraped: false, tasks: user.queuedTasks };
  }
  return { url, scraped: true, tasks: [] };
};
