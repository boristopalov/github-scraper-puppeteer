import { mongoClient } from "./utils/dbConnect.js";
import { start } from "./index.js";
import { DB_ENV } from "./constants/constants.js";

const startFromTerminal = async () => {
  if (process.argv.length < 4) {
    console.error("Usage: yarn queue ['repo' | 'org' | 'user'] [URL]");
    process.exit(1);
  }

  const type = process.argv[2];
  const url = process.argv[3];

  const client = await mongoClient();
  const db = DB_ENV === "testing" ? client.db("testing") : client.db("scraper");
  await start(db, type, url);
};

await startFromTerminal();
