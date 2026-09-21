import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const outputDirectory = new URL('../dist/', import.meta.url);
const projectDirectory = new URL('../', import.meta.url);
const staticFiles = [
  'styles.css',
  'textures.js',
  'webgl.js',
  'fallback2d.js',
  'main.js'
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(staticFiles.map(file =>
  cp(new URL(file, projectDirectory), new URL(file, outputDirectory))
));

const sourceHtml = await readFile(new URL('index.html', projectDirectory), 'utf8');
const productionHtml = sourceHtml.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
await writeFile(new URL('index.html', outputDirectory), productionHtml);

await build({
  entryPoints: [fileURLToPath(new URL('reference-world.js', projectDirectory))],
  outfile: fileURLToPath(new URL('reference-world.js', outputDirectory)),
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['es2020'],
  legalComments: 'none'
});

console.log('Sitio generado en dist/.');
