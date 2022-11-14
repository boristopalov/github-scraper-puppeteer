export const queueTaskdb = async (
  db,
  { type, parentType, parentId },
  { fn, args },
  { sendToFront = false, priority = 0 }
) => {
  const context = {
    type,
    parentType,
    parentId,
  };
  const inFront = { sendToFront, priority };
  const task = {
    fn,
    args,
  };
  await db
    .collection("queue")
    .insertOne({ inFront, context, task, createdAt: Date.now() });
};
