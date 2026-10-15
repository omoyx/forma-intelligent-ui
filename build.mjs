import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/app.jsx'], bundle: true, outfile: 'dist/app.js', format: 'esm',
  platform: 'browser', target: ['es2022'], minify: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', '__API_BASE__':JSON.stringify(process.env.INTELLIGENT_UI_API_BASE||'') } });
await build({ entryPoints: ['src/library.jsx'], bundle: true, outfile: 'dist/library.mjs', format: 'esm',
  platform: 'node', packages: 'external', jsx: 'automatic' });
await build({entryPoints:['src/styles.css'],bundle:true,outfile:'dist/styles.css',minify:true,loader:{'.png':'dataurl'}});
let html=await readFile('src/index.html','utf8');
for(const name of ['app.js','styles.css']){const hash=createHash('sha256').update(await readFile(`dist/${name}`)).digest('hex').slice(0,12);html=html.replace(`./${name}`,`./${name}?v=${hash}`);}
await writeFile('dist/index.html',html);
console.log('Intelligent UI built → dist/');
