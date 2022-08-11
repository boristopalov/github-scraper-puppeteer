import { csvExport } from "../csvExport.js";
import { exportRepo, exportOrg, exportUser } from "./export.js";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

const exportFromTerminal = async () => {
  dotenv.config({ path: "../../.env" });
  const uri = process.env.URI;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      return err;
    }
    const db = client.db("scraper");

    if (process.argv.length === 2) {
      csvExport(db);
      return;
    } else if (process.argv.length < 4) {
      console.error("Usage: yarn export ['repo' | 'org' | 'user'] [URL]");
      process.exit(1);
    }
    const type = process.argv[2];
    const url = process.argv[3];
    if (type === "repo") {
      await exportRepo(db, url);
    } else if (type === "org") {
      await exportOrg(db, url);
    } else if (type === "user") {
      await exportUser(db, url);
    } else {
      console.error("Possible types are: 'repo', 'org', or 'user'");
      process.exit(1);
    }
  });
};

exportFromTerminal();
