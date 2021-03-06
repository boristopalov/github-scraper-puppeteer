import sleep from "./sleep.js";

const checkForBotDetection = async (page) => {
  while (true) {
    let sleepMultiplier = 2;
    try {
      (await page.waitForXPath('//*[contains(text(), "Whoa there!")]', {
        timeout: 2000,
      })) !== null;
      console.log(
        "Abuse detection mechanism detected- waiting ",
        sleepMultiplier,
        " minutes before trying again."
      );
      // 1 minute * sleepMultiplier
      await sleep(60000 * sleepMultiplier);
      await page.reload();
      sleepMultiplier *= 2;
    } catch (e) {
      return;
    }
  }
};

export default checkForBotDetection;
