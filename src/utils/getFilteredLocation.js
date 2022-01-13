import searchTextForKeywords from "./searchTextForKeywords";

export default function getFilteredLocation(data, keywords) {
  let dataCopy = data.filter(
    (element) => searchTextForKeywords(element.location, keywords) === true
  );
  return dataCopy;
}
