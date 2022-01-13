import axios from "axios";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const TOKEN = process.env.TOKEN;

export async function getEvents(username) {
  const url = `https://api.github.com/users/${username}/events/public`;
  const res = await axios
    .get(url, {
      headers: {
        Authorization: `token ${TOKEN}`,
        "Content-Type": "application/json",
      },
    })
    .catch((error) => {
      console.error(error.message);
      return null;
    });

  return new Promise((resolve) => {
    resolve(res.data);
  });
}
