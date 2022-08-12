export const isServerActive = async (db) => {
  const adminDb = db.admin();
  const { connections } = await adminDb.serverStatus();
  console.log(connections);
  return connections.current > 3; // > 1 because the server itself needs to be connected to the database. idk why there's 3 though lol
};
