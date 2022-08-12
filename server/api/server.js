import express from "express";
import {
  checkIfOrgScraped,
  checkIfRepoScraped,
  checkIfUserScraped,
} from "../utils/scrapeCheck/checkIfScraped.js";
import { queueTaskdb } from "../utils/queueTask.js";
import { exportUser, exportOrg, exportRepo } from "../utils/export/export.js";
import { scrapeUserProfile } from "../puppeteer/users/scrapeUser.js";
import { scrapeRepo } from "../puppeteer/repos/scrapeRepo.js";
import { scrapeOrganization } from "../puppeteer/orgs/scrapeOrganization.js";
import { isServerActive } from "../utils/isServerActive.js";
// import { loopThroughQueue } from "../index.js";

export const startServer = (db) => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get("/", (req, res) => {
    res.send("hello");
  });
  app.get("/status", async (_, res) => {
    const status = await isServerActive(db);
    res.send(status);
  });
  app.get("/check/:type/:url", async (req, res) => {
    const { type, url } = req.params;
    console.log(req.params);
    let isScraped;
    if (type === "org") {
      isScraped = await checkIfOrgScraped(db, url);
    } else if (type === "repo") {
      risScrapedes = await checkIfRepoScraped(db, url);
    } else if (type === "user") {
      isScraped = await checkIfUserScraped(db, url);
    } else {
      res.send("only possible types are 'org', 'repo', and 'user'");
      return;
    }
    res.send(isScraped);
  });

  app.post("/queue", async (req, res) => {
    const { type, parentType, parentId, fn, args } = req.body;
    console.log(req.body);
    await queueTaskdb(db, { type, parentType, parentId }, { fn, args });
    res.send(true);
  });

  app.get("/start/:type/:url", async (req, res) => {
    const { type, url } = req.params;
    res.send("Scraper started");
    if (type === "repo") {
      await scrapeRepo(db, url);
    } else if (type === "org") {
      await scrapeOrganization(db, url);
    } else if (type === "user") {
      await scrapeUserProfile(db, url, null, true);
    } else {
      res.send("only possible types are 'org', 'repo', and 'user'");
      return;
    }
    res.send("looping through the queue now");
    // loopThroughQueue(db);
  });

  app.post("/export/:type/:url", async (req, res) => {
    const { type, url } = req.params;
    let fName;
    res.send(`exporting ${url}...`);
    if (type === "org") {
      fName = await exportOrg(db, url);
    } else if (type === "repo") {
      fName = await exportRepo(db, url);
    } else if (type === "user") {
      fName = await exportUser(db, url);
    } else {
      res.send("only possible types are 'org', 'repo', and 'user'");
      return;
    }
    const exportPath = `../data/${fName}`;
    res.sendFile(exportPath);
  });

  app.listen(8080, () => {
    console.log("listening on port", 8080);
  });
};
