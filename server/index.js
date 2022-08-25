import { start } from "./start.js";
const main = async () => {
  let tries = 2;
  while (tries > 0) {
    try {
      start();
      return;
    } catch (e) {
      console.error(e);
      tries--;
    }
  }
};

main();
