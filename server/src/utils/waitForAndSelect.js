/**
 * @param {{ waitForSelector: (arg0: any) => any; $: (arg0: any) => any; }} page
 * @param {string} selector
 */
async function waitForAndSelect(page, selector) {
  await page.waitForSelector(selector);
  return await page.$(selector);
}

export default waitForAndSelect;
