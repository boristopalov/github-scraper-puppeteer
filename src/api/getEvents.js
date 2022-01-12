import axios from "axios";

const COMMITS_TOKEN = process.env.COMMITS_TOKEN;

export async function getEvents(username) {
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

  return new Promise((resolve) => {
    resolve(res.data);
  });
}
