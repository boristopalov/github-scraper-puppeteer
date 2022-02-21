import fs from "fs";
import arrayOfObjectsToCSV from "./arrayOfObjectsToCSV.js";

const saveData = (data) => {
  // const savePath = `${path}`
  const csvPath = "../data/data-asdf.csv";
  const jsonPath = "../data/data-asdf.json";
  let jsonStream = fs.createWriteStream(jsonPath, { flags: "a" });
  jsonStream.write(JSON.stringify(data));
  jsonStream.end();
  // convert data to csv-formatted string and save it to a .csv file
  let dataStream = fs.createWriteStream(csvPath, { flags: "a" });
  const csvString = arrayOfObjectsToCSV(data);
  dataStream.write(csvString);
  dataStream.end();
  console.log(`wrote data to ${csvPath}`);
  return csvPath;
};

export default saveData;
