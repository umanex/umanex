import StyleDictionary from 'style-dictionary';
import { register } from '@tokens-studio/sd-transforms';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Register Tokens Studio transforms
register(StyleDictionary, { excludeParentKeys: true });

// Read tokens.json
const raw = JSON.parse(await readFile('./tokens.json', 'utf-8'));
const { $themes, $metadata, ...tokenSets } = raw;

// Find umanex theme
const umanexTheme = $themes.find(t => t.name === 'umanex');
if (!umanexTheme) throw new Error('Theme "umanex" not found in $themes');

// Merge enabled token sets in order
const enabledSets = Object.entries(umanexTheme.selectedTokenSets)
  .filter(([, status]) => status === 'enabled')
  .map(([setName]) => setName);

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !('value' in value)) {
      target[key] = target[key] || {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

const mergedTokens = {};
for (const setName of enabledSets) {
  const setTokens = tokenSets[setName];
  if (setTokens) deepMerge(mergedTokens, setTokens);
}

if (!existsSync('./build')) await mkdir('./build', { recursive: true });
await writeFile('./build/_merged.json', JSON.stringify(mergedTokens, null, 2));

const ALLOWED_TYPES = ['color', 'spacing', 'borderRadius', 'fontFamilies', 'fontSizes', 'lineHeights', 'fontWeights'];

const sd = new StyleDictionary({
  source: ['./build/_merged.json'],
  log: {
    verbosity: 'default',
    errors: { brokenReferences: 'console' },
  },
  platforms: {
    css: {
      transformGroup: 'tokens-studio',
      prefix: 'umanex',
      buildPath: 'build/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables',
        filter: (token) => ALLOWED_TYPES.includes(token.$type ?? token.type),
        options: {
          selector: ':root',
          outputReferences: false,
        },
      }],
    },
    js: {
      transformGroup: 'tokens-studio',
      buildPath: 'build/',
      files: [{
        destination: 'tailwind.js',
        format: 'javascript/esm',
        filter: (token) => ALLOWED_TYPES.includes(token.$type ?? token.type),
      }],
    },
  },
});

await sd.buildAllPlatforms();
console.log('\n✓ @umanex/tokens build complete → build/variables.css + build/tailwind.js');
