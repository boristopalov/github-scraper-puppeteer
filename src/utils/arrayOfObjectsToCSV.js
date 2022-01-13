export default function arrayOfObjectsToCSV(arr) {
  const csvString = [
    ["Name", "Email", "Username", "Company", "Location", "Bio"],
    ...arr.map((e) => [
      e.name.replaceAll(",", ""),
      e.email,
      e.username,
      e.company.replaceAll(",", ";"),
      e.location.replaceAll(",", ""),
      e.bio.replaceAll("\n", "").replaceAll(",", ";"),
    ]),
  ]
    .map((item) => item.join(","))
    .join("\n");
  return csvString;
}
