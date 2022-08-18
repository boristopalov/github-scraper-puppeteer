export const isServerActive = async (db) => {
  const adminDb = db.admin();
  const { connections } = await adminDb.serverStatus();
  return connections.current > 2; // >2 because atlas makes some connections other than just with the client
};
