import { queueTaskdb } from "./queueTask.js";
import { MongoClient, ServerApiVersion } from "mongodb";
import { URI, DB_ENV } from "../constants/constants.js";

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
  const uri = URI;
  const client = new MongoClient(uri, {
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const db = client.db(DB_ENV);
    let fn;
    let priority;
    if (type === "repo") {
      fn = "scrapeRepo";
      priority = 2;
    }
    if (type === "org") {
      fn = "scrapeOrganization";
      priority = 3;
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
    await client.close();
  });
  return;
};

queueFromTerminal();
