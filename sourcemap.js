import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

const rawSourceMap = fs.readFileSync('./dist/assets/index-CVSGg9_M.js.map', 'utf8');
const rawSourceMapJson = JSON.parse(rawSourceMap);

SourceMapConsumer.with(rawSourceMapJson, null, consumer => {
  console.log('Error 1:', consumer.originalPositionFor({ line: 513, column: 69352 }));
  console.log('Error 2:', consumer.originalPositionFor({ line: 38, column: 17821 }));
});
