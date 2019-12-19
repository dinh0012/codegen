import * as fs from "fs";

export const getOps = ( type) => {
  const file = __dirname + '/../confFormat/' + type + '.json';
  return JSON.parse(fs.readFileSync(file, 'UTF-8'));;
}
