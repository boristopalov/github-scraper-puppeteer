module.exports = {
  // i didn't use this
  searchTextForKeywords: function (text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
  },

  // probably a better way to do this
  getFilteredBio: async function (data, keywords) {
    let dataCopy = await data.filter(
      (element) => searchTextForKeywords(element.bio, keywords) === true
    );
    return dataCopy;
  },

  getFilteredLocation: async function (data, keywords) {
    let dataCopy = await data.filter(
      (element) => searchTextForKeywords(element.location, keywords) === true
    );
    return dataCopy;
  },

  // convert an array of objects to a csv-formatted string
  arrayOfObjectsToCSV: function (arr) {
    const csvString = [
      ["Name", "Email", "Username", "Company", "Location", "Bio"],
      ...arr.map((e) => [
        e.name.replaceAll(",", ""),
        e.email,
        e.username,
        e.company.replaceAll(",", ";"),
        e.location.replaceAll(",", ""),
        e.bio.replaceAll("\n", "").replaceAll(",", ";"),
      ]),
    ]
      .map((item) => item.join(","))
      .join("\n");
    return csvString;
  },

  getHrefFromAnchor: async function (context, selector) {
    const queryResponse = await context.$(selector);
    if (!queryResponse) {
      return null;
    }
    const hrefObject = await queryResponse.getProperty("href");
    const url = await hrefObject.jsonValue();
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error("can't get an href!"));
      }
      resolve(url);
    });
  },

  // passing in both the username and the name here so we can cross-check them with emails
  // we want the email to match either the username or the name (either or)
  searchEventsForEmail: function (events, username, name) {
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
                console.log(author.email);
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
  },

  // gets the urls of all of the repos the user made a pull request for
  searchEventsForPullRequests: function (events) {
    const urls = [];
    for (const e of events) {
      if (e.type === "PullRequestEvent") {
        // instead of using the github api again, use
        const url = e.repo.url.replace("repos", "");
        urls.push(urls);
      }
    }
  },

  calculateWeightedCandidateScore: function (candidate) {},
};
