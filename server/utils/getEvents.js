import axios from "axios";
import { TOKEN } from "../constants/constants.js";

export async function getEvents(username) {
  const token = TOKEN;
  const url = `https://api.github.com/users/${username}/events/public`;
  const res = await axios
    .get(url, {
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
    })
    .catch((error) => {
      console.error(error.message);
      return null;
    });

  return res.data || null;
}
