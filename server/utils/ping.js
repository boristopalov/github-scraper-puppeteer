export const ping = async (db) => {
  const adminDb = db.admin();
  const status = await adminDb.serverStatus();
  return status ? true : false;
};
