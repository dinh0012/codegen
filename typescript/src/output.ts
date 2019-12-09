import * as fs from 'fs';
import * as path from 'path';
import {CodeGen} from './lib/codegen'

const getPath = (path) => {
  return __dirname + '/../' + path;
}

if (!process.argv[2]) {
  console.log('Set input type code.');
  process.exit(1);
}

const typeCode = process.argv[2];
const typeCodeConfPath = getPath(`conf/${typeCode}.json`)
const typeCodeConf = JSON.parse(fs.readFileSync(typeCodeConfPath, 'UTF-8'));
const outputDir = typeCodeConf.basedir + '/';

const file = getPath(`${typeCode}.json`);
const swagger = JSON.parse(fs.readFileSync(file, 'UTF-8'));

const outputFile = (swagger, template, filepath) => {
    const source = CodeGen.getCustomCode({
        swagger,
        lint: false,
        beautify: false,
        template
    });
    const outputPath = outputDir + filepath;
    const dir = path.dirname(outputPath)
    !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });
    console.log(dir)
    fs.writeFileSync(outputPath, source);
    console.log('Output ' + outputPath);
};

const readFileData = (path) => fs.readFileSync(getPath(path), 'utf-8');

typeCodeConf.gen.map((part) => {
    const template = {};
    for (const key in part) {
        if (key !== 'filepath') {
            if (part[key] === 'only exist avoid errors') {
                template[key] = part[key];
            } else {
                template[key] = readFileData(part[key]);
            }
        }
    }
    outputFile(
        swagger,
        template,
        part.filepath
    );
})
