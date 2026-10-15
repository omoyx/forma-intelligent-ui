import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('dist-server',{recursive:true});
await build({entryPoints:['server.mjs'],bundle:true,outfile:'dist-server/server.mjs',platform:'node',format:'esm',target:'node22',minify:true,banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'}});
console.log('Standalone server built → dist-server/server.mjs');
