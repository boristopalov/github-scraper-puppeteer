const axios = require("axios").default;

const COMMITS_TOKEN = process.env.COMMITS_TOKEN;

module.exports = {
  // retrieves data on public events from github API (public commits, pull requests, reviews, etc)
  getEvents: async function (username) {
    const url = `https://api.github.com/users/${username}/events/public`;
    const res = await axios
      .get(url, {
        headers: {
          Authorization: `token ${COMMITS_TOKEN}`,
          "Content-Type": "application/json",
        },
      })
      .catch((error) => {
        console.error(error);
        return null;
      });

    return new Promise((resolve, reject) => {
      resolve(res.data);
    });
  },
};
