export const isScraperActive = async (db) => {
  const adminDb = db.admin();
  const { connections } = await adminDb.serverStatus();
  console.log(connections);
  return connections.current > 3; // >3 because atlas makes some connections other than just with the client
};
