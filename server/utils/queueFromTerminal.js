import { queueTaskdb } from "./queueTask.js";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";
import { scrapeFromQueuedb } from "../puppeteer/queue/scrapeFromQueue.js";

export const queueFromTerminal = () => {
  if (process.argv.length < 4) {
    console.error("Usage: yarn queue ['repo' | 'org' | 'user'] [URL]");
    process.exit(1);
  }
  const type = process.argv[2];
  const url = process.argv[3];
  // console.log(type);

  if (type !== "repo" && type !== "user" && type !== "org") {
    console.error("Possible types are: 'repo', 'org', or 'user'");
    process.exit(1);
  }
  dotenv.config({ path: "../.env" });
  const uri = process.env.URI;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const db = client.db("scraper");

    let fn;
    let depth;
    if (type === "repo") {
      fn = "scrapeRepo";
      depth = 2;
    }
    if (type === "org") {
      fn = "scrapeOrganization";
      depth = 1;
    }
    if (type === "user") {
      fn = "scrapeUserProfile";
      depth = 3;
    }
    await queueTaskdb(
      db,
      { type, parentId: null, parentType: null },
      { fn, args: [url] },
      { sendToFront: true, depth }
    );
    await client.close();
  });
  return;
};

queueFromTerminal();
