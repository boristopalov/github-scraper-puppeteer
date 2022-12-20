import { writeToClient } from "../index.js";
import sleep from "../utils/sleep.js";
import { io } from "../ws/socket.js";

const checkForBotDetection = async (page, res) => {
  let sleepMultiplier = 2;
  try {
    while (
      (await page.waitForXPath(
        '//div[@class="c" and .//*[contains(text(), "Whoa there!")]]',
        {
          timeout: 2000,
        }
      )) !== null
    ) {
      writeToClient(
        `Abuse detection mechanism detected- waiting ${sleepMultiplier} minutes before trying again.`,
        io
      );
      // 1 minute * sleepMultiplier
      await sleep(60000 * sleepMultiplier);
      await page.reload();
      sleepMultiplier *= 2;
    }
  } catch (e) {
    return;
  }
};

export default checkForBotDetection;
