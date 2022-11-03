export default async function getHrefFromAnchor(context, selector) {
  const element = await context.$(selector);
  if (element === null) {
    return null;
  }
  const hrefProp = await element.getProperty("href");
  const url = await hrefProp.jsonValue();
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("can't get an href!"));
    }
    resolve(url);
  });
}
