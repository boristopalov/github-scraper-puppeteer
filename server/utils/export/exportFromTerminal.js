import { mongoClient } from "../dbConnect.js";
import { csvExport } from "../csvExport.js";
import { exportRepo, exportOrg, exportUser } from "./export.js";

const exportFromTerminal = async () => {
  try {
    const client = await mongoClient();
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
      exportRepo(db, url);
    } else if (type === "org") {
      exportOrg(db, url);
    } else if (type === "user") {
      exportUser(db, url);
    } else {
      console.error("Possible types are: 'repo', 'org', or 'user'");
      process.exit(1);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

exportFromTerminal();
