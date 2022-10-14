import express from "express";
import {
  checkIfOrgScraped,
  checkIfRepoScraped,
  checkIfUserScraped,
} from "../utils/scrapeCheck/checkIfScraped.js";
import { exportUser, exportOrg, exportRepo } from "../utils/export/export.js";
import { isScraperActive } from "../utils/isScraperActive.js";
import { start } from "../index.js";
import cors from "cors";
import { mongoClient } from "../utils/mongoClient.js";
import { fileURLToPath } from "url";
import path from "path";
import { toggleScraperFlag } from "../puppeteer/stopScraperFlag.js";

export const startServer = async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: "http://localhost:3000",
    })
  );

  const client = await mongoClient();
  const db =
    process.env.DB_ENV === "testing"
      ? client.db("testing")
      : client.db("scraper");

  app.get("/", (_, res) => {
    res.send("hello");
  });
  app.get("/status", async (_, res) => {
    const status = await isScraperActive(db);
    const msg = {
      active: status,
      message: status ? "Scraper is running." : "Scraper is not running.",
    };
    res.json(msg);
  });
  app.get("/check", async (req, res) => {
    const { type, url } = req.query;
    let isScraped;
    if (type === "org") {
      isScraped = await checkIfOrgScraped(db, url);
    } else if (type === "repo") {
      isScraped = await checkIfRepoScraped(db, url);
    } else if (type === "user") {
      isScraped = await checkIfUserScraped(db, url);
    } else {
      res.send("only possible types are 'org', 'repo', and 'user'");
      return null;
    }
    res.send(isScraped);
  });

  app.get("/scrape", async (req, res) => {
    const { type, url } = req.query;

    // set headers and send them to the client
    // this establishes an SSE connection with the client
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.on("close", res.end);

    res.write("data: starting scraper...\n\n");
    await start(db, type, url, res);
  });

  app.post("/kill", async (_, res) => {
    toggleScraperFlag();
    res.send("stopping scraper...");
  });

  app.get("/export", async (req, res) => {
    const { type, url } = req.query;
    try {
      let fileName;
      if (type === "org") {
        fileName = await exportOrg(db, url);
      } else if (type === "repo") {
        fileName = await exportRepo(db, url);
      } else if (type === "user") {
        fileName = await exportUser(db, url);
      } else {
        res.send("only possible types are 'org', 'repo', and 'user'");
        return;
      }
      if (!fileName) {
        res.send(null);
        return;
      }
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const exportPath = path.resolve(__dirname + `/../data/${fileName}`);
      res.download(exportPath);
    } catch (e) {
      console.error(e);
      res.send(null);
    }

    app.get("/download", async (req, res) => {
      const downloadPath = req.query.path;
      res.download(downloadPath);
    });
  });

  app.listen(8080, () => {
    console.log("listening on port", 8080);
  });
};

export const writeToClient = (res, data) => {
  res.write("data: " + `${data}\n\n`);
};

startServer();
