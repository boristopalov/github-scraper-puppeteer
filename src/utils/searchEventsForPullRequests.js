export default function searchEventsForPullRequests(events, username) {
  const urls = new Set();
  for (const e of events) {
    if (e.type === "PullRequestEvent" && !e.repo.url.includes(username)) {
      // instead of using the github api again, use puppeteer
      const url = e.repo.url.replace("/repos", "").replace("://api.", "://");
      urls.add(url);
    }
  }

  const arr = Array.from(urls);
  if (urls.size > 5) {
    return arr.slice(0, 5);
  }
  return arr;
}
