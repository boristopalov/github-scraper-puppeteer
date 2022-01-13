export default function getPullRequestRepoUrlsFromEvents(events) {
  const urls = [];
  for (const e of events) {
    if (e.type === "PullRequestEvent") {
      // instead of using the github api again, use
      const url = e.repo.url.replace("repos", "");
      urls.push(urls);
    }
  }
  return urls;
}
