import { exportAllScrapedUsers } from "./exportAllScrapedUsers";
import { exportRepo, exportOrg, exportUser } from "./export.js";
import { MongoClient, ServerApiVersion } from "mongodb";
import { URI, DB_ENV } from "../../constants/constants.js";

const exportFromTerminal = async () => {
  const uri = URI;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect(async (err) => {
    if (err) {
      return err;
    }
    const db =
      DB_ENV === "testing" ? client.db("testing") : client.db("scraper");
    if (process.argv.length === 2) {
      exportAllScrapedUsers(db);
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
