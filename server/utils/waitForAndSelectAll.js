async function waitForAndSelectAll(page, selector) {
  await page.waitForSelector(selector);
  return await page.$$(selector);
}

export default waitForAndSelectAll;
