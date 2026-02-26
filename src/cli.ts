#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { generatePDF } from './pdf/generator.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: md2pdf <input.md> <output.pdf> [options]');
  console.error('Options:');
  console.error('  --title <title>       Set PDF title');
  console.error('  --author <author>     Set PDF author');
  console.error('  --font-size <size>    Set base font size (default: 12)');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1];

let title: string | undefined;
let author: string | undefined;
let fontSize = 12;

for (let i = 2; i < args.length; i++) {
  switch (args[i]) {
    case '--title':
      title = args[++i];
      break;
    case '--author':
      author = args[++i];
      break;
    case '--font-size':
      fontSize = parseInt(args[++i]);
      break;
    default:
      console.warn(`Unknown option: ${args[i]}`);
  }
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

const markdown = fs.readFileSync(inputFile, 'utf-8');

const outputDir = path.dirname(outputFile);
if (outputDir && !fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Converting ${inputFile} to ${outputFile}...`);

generatePDF(markdown, outputFile, {
  title: title || path.basename(inputFile, '.md'),
  author,
  fontSize,
})
  .then(() => {
    console.log('Done!');
  })
  .catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
