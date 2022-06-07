async function waitForAndSelect(page, selector) {
  await page.waitForSelector(selector);
  return await page.$(selector);
}

export default waitForAndSelect;
