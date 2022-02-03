import fs from "fs";
import arrayOfObjectsToCSV from "./arrayOfObjectsToCSV.js";

const saveData = (data) => {
  // const savePath = `${path}`
  const DATAFILE = "../data/data-asdf.csv";
  const JSONFILE = "../data/data-asdf.json";
  let jsonStream = fs.createWriteStream(JSONFILE, { flags: "a" });
  jsonStream.write(JSON.stringify(data));
  jsonStream.end();

  // convert data to csv-formatted string and save it to a .csv file
  let dataStream = fs.createWriteStream(DATAFILE, { flags: "a" });
  const csvString = arrayOfObjectsToCSV(data);
  dataStream.write(csvString);
  dataStream.end();
  console.log(`wrote data to ${DATAFILE}`);
  return DATAFILE;
  // return fs.readFileSync(DATAFILE);
};

// const saveDataExpress = (data, path) => {
//   const savePath = `${path}`
//   const DATAFILE = "../data/data-marak.csv";
//   const JSONFILE = "../data/data-marak.json";
//   let jsonStream = fs.createWriteStream(JSONFILE, { flags: "a" });
//   jsonStream.write(JSON.stringify(data));
//   jsonStream.end();

//   // convert data to csv-formatted string and save it to a .csv file
//   let dataStream = fs.createWriteStream(DATAFILE, { flags: "a" });
//   const csvString = arrayOfObjectsToCSV(data);
//   dataStream.write(csvString);
//   dataStream.end();
//   console.log(`wrote data to ${DATAFILE}`);
//   return;
// };

export default saveData;
