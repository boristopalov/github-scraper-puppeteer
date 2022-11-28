export const checkIfOrgScraped = async (db, url) => {
  url = url.toLowerCase();
  const org = await db.collection("orgs").findOne({ url });
  if (!org) {
    return { url, scraped: false, tasks: null };
  }

  if (org.queuedTasks.length > 0) {
    return { url, scraped: false, tasks: org.queuedTasks };
  }

  const unscrapedRepos = [];
  for (const repoUrl of org.reposInOrg) {
    const repoScraped = await checkIfRepoScraped(db, repoUrl);
    if (!repoScraped.scraped) {
      unscrapedRepos.push(repoScraped);
    }
  }
  return { url, scraped: unscrapedRepos.length === 0, tasks: unscrapedRepos };
};

export const checkIfRepoScraped = async (db, url) => {
  url = url.toLowerCase();
  const repo = await db.collection("repos").findOne({ url });
  if (!repo) {
    return { url, scraped: false, tasks: null };
  }

  const unscrapedUsers = [];

  if (repo.queuedTasks.length > 0) {
    repo.queuedTasks.forEach((user, i) => {
      unscrapedUsers[i] = { url: user, scraped: false, tasks: [] };
    });
  }

  for (const username of Object.keys(repo.contributors)) {
    const url = `https://github.com/${username}`.toLowerCase();
    const userScraped = await checkIfUserScraped(db, url);
    if (!userScraped.scraped) {
      unscrapedUsers.push(userScraped);
    }
  }

  return { url, scraped: unscrapedUsers.length === 0, tasks: unscrapedUsers };
};

export const checkIfUserScraped = async (db, url) => {
  url = url.toLowerCase();
  const user = await db.collection("users").findOne({ url });
  if (!user) {
    return { url, scraped: false, tasks: null };
  }
  if (user.queuedTasks.length > 0) {
    return { url, scraped: false, tasks: user.queuedTasks };
  }
  return { url, scraped: true, tasks: [] };
};
