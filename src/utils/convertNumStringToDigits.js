export default function convertNumStringToDigits(numString) {
  const thousand = "K";
  const million = "M";
  if (numString.toUpperCase().includes(thousand))
    return parseFloat(numString) * 1000;
  else if (numString.toUpperCase().includes(million))
    return parseFloat(numString) * 1000000;
}
