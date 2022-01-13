export default function searchEventsForEmail(events, username, name) {
  // yikes
  // I think Typescript could fix this with optional chaining
  for (const e of events) {
    if (e.hasOwnProperty("payload")) {
      let payload = e.payload;
      if (payload.hasOwnProperty("commits")) {
        let commits = payload.commits;
        for (const c of commits) {
          if (c.hasOwnProperty("author")) {
            let author = c.author;
            if (
              !author.email.includes("noreply") &&
              author.name
                .split(" ")
                .some(
                  (e) =>
                    name.toLowerCase().includes(e.toLowerCase()) ||
                    username.toLowerCase().includes(e.toLowerCase())
                )
            ) {
              return author.email || "n/a";
            }
          }
        }
      }
    }
  }
  // we reach the end of the loop and there are no valid emails
  console.log("n/a");
  return "n/a";
}
