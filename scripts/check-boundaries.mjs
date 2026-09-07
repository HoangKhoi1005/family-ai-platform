import { readdirSync, readFileSync } from 'node:fs';
const allowed = {
  '@family/web': ['@family/ui', '@family/contracts', '@family/domain'],
  '@family/api': ['@family/contracts', '@family/domain', '@family/config', '@family/database'],
  '@family/worker': ['@family/config', '@family/domain', '@family/database'],
  '@family/ui': [],
  '@family/contracts': [],
  '@family/domain': [],
  '@family/config': [],
  '@family/database': [],
};
let count = 0;
for (const folder of ['apps', 'packages']) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkg = JSON.parse(readFileSync(`${folder}/${entry.name}/package.json`, 'utf8'));
    if (!allowed[pkg.name]) throw new Error(`Unregistered workspace: ${pkg.name}`);
    if (!pkg.private) throw new Error(`${pkg.name} must be private`);
    for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (dependency.startsWith('@family/') && !allowed[pkg.name].includes(dependency))
        throw new Error(`Forbidden dependency: ${pkg.name} -> ${dependency}`);
    }
    count++;
  }
}
console.log(`Workspace dependency boundaries checked: ${count} packages.`);
