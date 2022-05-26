export const queueTask = (queue, { db, type, parentType, parentId }, task) => {
  const context = {
    db,
    type,
    parentType,
    parentId,
  };
  queue.push({ context, task });
};
