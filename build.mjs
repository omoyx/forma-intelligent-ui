import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/app.jsx'], bundle: true, outfile: 'dist/app.js', format: 'esm',
  platform: 'browser', target: ['es2022'], minify: true, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', '__API_BASE__':JSON.stringify(process.env.INTELLIGENT_UI_API_BASE||'') } });
await build({ entryPoints: ['src/library.jsx'], bundle: true, outfile: 'dist/library.mjs', format: 'esm',
  platform: 'node', packages: 'external', jsx: 'automatic' });
await copyFile('src/index.html', 'dist/index.html');
await build({entryPoints:['src/styles.css'],bundle:true,outfile:'dist/styles.css',minify:true,loader:{'.png':'dataurl'}});
console.log('Intelligent UI built → dist/');
