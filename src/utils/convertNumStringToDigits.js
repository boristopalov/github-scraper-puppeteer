export default function convertNumStringToDigits(numString) {
  const thousand = "K";
  const million = "M";
  const parsed = parseInt(numString);
  if (numString.toUpperCase().includes(thousand)) return parsed * 1000;
  else if (numString.toUpperCase().includes(million)) return parsed * 1000000;
  else return parsed;
}
