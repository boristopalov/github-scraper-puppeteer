import express from "express";
import {
  checkIfOrgScraped,
  checkIfRepoScraped,
  checkIfUserScraped,
} from "./scrapeCheck/checkIfScraped.js";
import { exportCSV } from "./export/export.js";
import { scrape, scrapeFromQueueLoop } from "./scrape/startScraper.js";
import cors from "cors";
import { mongoClient } from "./db/mongoClient.js";
import {
  stopScraperFlag,
  startScraperFlag,
  TASKS_PROCESSING_FLAG,
  INITIAL_TASK_PROCESSING,
} from "./utils/scraperStatus.js";
import { ping } from "./utils/ping.js";
import { queueTaskdb } from "./scrape/queue/queueTask.js";
import { DB_ENV } from "./constants/envVars.js";
import { emitter } from "./scrape/startScraper.js";
export const startServer = async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://54.197.13.104:3000",
        "http://54.197.13.104",
        "http://scraper.comm.tools",
        "http://scraper.comm.tools:3000",
        "http://scraper.comm.tools/",
      ],
    })
  );

  const client = await mongoClient();
  const db = client.db(DB_ENV);

  app.get("/", (_, res) => {
    res.send("hello");
  });

  app.get("/status", async (_, res) => {
    const msg = {
      active: INITIAL_TASK_PROCESSING || TASKS_PROCESSING_FLAG,
      message:
        INITIAL_TASK_PROCESSING || TASKS_PROCESSING_FLAG
          ? "Scraper is running."
          : "Scraper is not running.",
    };
    res.json(msg);
  });

  app.get("/ping", async (_, res, next) => {
    try {
      const status = await ping(db);
      const msg = {
        active: status,
        message: status ? "Server is running." : "Server is not running.",
      };
      res.json(msg);
    } catch (error) {
      next(error);
    }
  });

  app.get("/check", async (req, res, next) => {
    try {
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
      res.json(isScraped);
    } catch (error) {
      next(error);
    }
  });

  app.get("/scrape", async (req, res, next) => {
    try {
      let { type, url } = req.query;
      url = url.toLowerCase();

      // set headers and send them to the client
      // this establishes an SSE connection with the client
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.on("close", res.end);

      if (INITIAL_TASK_PROCESSING || TASKS_PROCESSING_FLAG) {
        res.write(
          "Scraper is already running and should be scraping from the queue.\n\n"
        );
        return;
      }

      res.write("data: scraper started...\n\n");
      startScraperFlag();

      if (url === "") {
        await scrapeFromQueueLoop(db, res);
      } else {
        if (!url.includes("https://github.com")) {
          console.error(
            `error- please enter a valid GitHub url, you entered: ${url}`
          );
          stopScraperFlag();
          return;
        }
        await scrape(db, type, url, res);
      }
    } catch (error) {
      console.log(error.stack);
      next(error);
    }
  });

  app.post("/kill", (_, res) => {
    stopScraperFlag();
    if (!TASKS_PROCESSING_FLAG) {
      emitter.once("INITIAL_TASK_DONE", () => {
        res.send("scraped stopped\n");
      });
    } else {
      emitter.once("TASKS_DONE", () => {
        res.send("scraped stopped\n");
      });
    }
  });

  app.post("/enqueue", async (req, res, next) => {
    try {
      let { type, url } = req.body;
      url = url.toLowerCase();
      if (url === "") {
        res.send(`[${new Date().toLocaleTimeString()}]url cannot be empty`);
        return;
      }
      if (!url.includes("https://github.com")) {
        res.send(
          `[${new Date().toLocaleTimeString()}] please enter a valid GitHub URL.`
        );
        return;
      }
      if (await db.collection(`${type}s`).findOne({ url })) {
        res.send(`[${new Date().toLocaleTimeString()}]already scraped ${url}`);
        return;
      }
      if (await db.collection(`queue`).findOne({ "task.args.0": url })) {
        res.send(
          `[${new Date().toLocaleTimeString()}]${url} is already in the queue`
        );
        return;
      }
      let fn;
      let priority;
      if (type === "org") {
        fn = "scrapeOrganization";
        priority = 3;
      }
      if (type === "repo") {
        fn = "scrapeRepo";
        priority = 2;
      }
      if (type === "user") {
        fn = "scrapeUserProfile";
        priority = 1;
      }
      await queueTaskdb(
        db,
        { type, parentId: null, parentType: null },
        { fn, args: [url] },
        { sendToFront: true, priority }
      );

      res.send(
        `[${new Date().toLocaleTimeString()}]added ${url} to the front of the queue`
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/export", async (req, res, next) => {
    try {
      const { type, url, unexportedOnly } = req.query;
      const unexportedOnlyBool = unexportedOnly === "true";
      const fileName = await exportCSV(db, type, url, unexportedOnlyBool);
      if (!fileName) {
        res.send(null);
        return;
      }
      res.download(fileName);
    } catch (error) {
      next(error);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, _0, response, _1) => {
    console.log(`error ${error.message}`);
    const status = error.status || 400;
    try {
      response.write(error.message);
    } catch (e) {
      response.status(status).send(error.message);
    }
  });

  // fallback
  // eslint-disable-next-line no-unused-vars
  app.use((_0, response, _1) => {
    response.status(404);
    response.send("invalid path");
  });

  app.listen(8080, () => {
    console.log("listening on port", 8080);
  });
};

export const writeToClient = (res, data) => {
  console.log(`[${new Date().toLocaleTimeString()}]${data}`);
  res.write("data: " + `[${new Date().toLocaleTimeString()}]${data}\n\n`);
};

startServer();
