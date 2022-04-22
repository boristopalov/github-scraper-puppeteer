import { scrapeOrganization } from "../scrapeOrganization.js";
import { scrapeRepo } from "../scrapeRepo.js";
import { scrapeUserProfile } from "../scrapeUserProfile.js";

export const scrapeRepoCluster = async ({ page, data }) => {
  const { url, db, cluster } = data;
  try {
    await page.goto(url);
    const repoData = await scrapeRepo(page, db, cluster);
    return new Promise((resolve) => resolve(repoData));
  } catch (e) {
    console.log("Stack Trace", e.stack);
    // process.exit(1);
  }
};

export const scrapeUserCluster = async ({ page, data }) => {
  const { url, isStartingScrape, db, dataObj, cluster } = data;
  try {
    await page.goto(url);
    const userData = await scrapeUserProfile(
      page,
      isStartingScrape,
      db,
      dataObj,
      cluster
    );
    return new Promise((resolve) => resolve(userData));
  } catch (e) {
    console.log("Stack Trace", e.stack);
    // process.exit(1);
  }
};

export const scrapeOrgCluster = async ({ page, data }) => {
  const { url, db, cluster } = data;
  try {
    await page.goto(url);
    const orgData = await scrapeOrganization(page, db, cluster);
    return new Promise((resolve) => resolve(orgData));
  } catch (e) {
    console.log("Stack Trace", e.stack);
    // process.exit(1);
  }
};
