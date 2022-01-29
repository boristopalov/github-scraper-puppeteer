import fs from "fs";
import arrayOfObjectsToCSV from "./arrayOfObjectsToCSV.js";

const saveData = async (data) => {
  const DATAFILE = "../data/data-marak.csv";
  const JSONFILE = "../data/data-marak.json";
  let jsonStream = fs.createWriteStream(JSONFILE, { flags: "a" });
  jsonStream.write(JSON.stringify(data));
  jsonStream.end();

  // convert data to csv-formatted string and save it to a .csv file
  let dataStream = fs.createWriteStream(DATAFILE, { flags: "a" });
  const csvString = arrayOfObjectsToCSV(data);
  dataStream.write(csvString);
  dataStream.end();
  console.log(`wrote data to ${DATAFILE}`);
  return;
};

export default saveData;
