import searchTextForKeywords from "./searchTextForKeywords.js";

export default function getFilteredBio(data, keywords) {
  let dataCopy = data.filter(
    (element) => searchTextForKeywords(element.bio, keywords) === true
  );
  return dataCopy;
}
