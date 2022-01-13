export default function searchTextForKeywords(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}
