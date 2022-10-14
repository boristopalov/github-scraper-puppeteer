import { STOP_SCRAPER_FLAG } from "../puppeteer/stopScraperFlag.js";

export const isScraperActive = async (db) => {
  const adminDb = db.admin();
  const { connections } = await adminDb.serverStatus();
  console.log(connections);
  return connections.current > 4 && !STOP_SCRAPER_FLAG; // >3 because of ping(), and atlas makes some connections other than just with the client
};
