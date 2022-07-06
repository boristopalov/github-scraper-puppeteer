export const queueTaskdb = async (
  db,
  { type, parentType, parentId },
  { fn, args }
) => {
  const context = {
    type,
    parentType,
    parentId,
  };
  const task = {
    fn,
    args,
  };
  await db
    .collection("queue")
    .insertOne({ context, task, createdAt: Date.now() });
};
