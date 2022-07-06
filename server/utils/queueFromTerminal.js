import { queueTaskdb } from "./queueTask.js";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

export const queueFromTerminal = () => {
  if (process.argv.length < 4) {
    console.log(
      "Error- please provide a URL and type ('repo', 'user', or 'org')"
    );
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
    const url = process.argv[2];
    const type = process.argv[3];
    let fn;
    if (type === "repo") {
      fn = "srapeRepo";
    }
    if (type === "org") {
      fn = "scrapeOrganization";
    }
    if (type === "user") {
      fn = "scrapeUserProfile";
    }
    await queueTaskdb(
      db,
      { type, parentId: null, parentType: null },
      { fn, args: [url] }
    );
    await client.close();
  });
  return;
};

queueFromTerminal();
