import { readFileSync, writeFileSync } from 'node:fs';
const tokens = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'));
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const lines = [];
for (const [group, values] of Object.entries(tokens)) {
  if (typeof values !== 'object') continue;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'boolean') continue;
    const unit = group.endsWith('Px') || key.endsWith('Px') ? 'px' : key.endsWith('Ms') ? 'ms' : '';
    lines.push(`  --${kebab(group)}-${kebab(key)}: ${value}${unit};`);
  }
}
const output = `/* Generated from design/tokens.json. Run npm run tokens:generate. */\n:root {\n${lines.join('\n')}\n}\n`;
const destination = new URL('../packages/ui/src/tokens.css', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== output) throw new Error('Design tokens are stale.');
  console.log('Design tokens match their source.');
} else writeFileSync(destination, output);
