import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import ts from 'typescript';

const units = [
  { path: 'packages/core', allowed: [] },
  { path: 'packages/audio-engine', allowed: ['@guitar-practice/core'] },
  { path: 'packages/study-project', allowed: ['@guitar-practice/core'] },
  { path: 'packages/alphatab-adapter', allowed: ['@guitar-practice/core', '@coderline/alphatab', '@coderline/alphatab/core'] },
  { path: 'apps/web', allowed: ['@guitar-practice/core', '@guitar-practice/audio-engine', '@guitar-practice/study-project', '@guitar-practice/alphatab-adapter', '@angular/', '@jsverse/transloco', 'rxjs', 'tslib'] },
];
const violations = [];
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
  });
}
for (const unit of units) {
  const allowed = (name) => unit.allowed.some((item) => item.endsWith('/') ? name.startsWith(item) : name === item);
  const manifest = JSON.parse(readFileSync(`${unit.path}/package.json`, 'utf8'));
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (!allowed(name)) violations.push(`${unit.path}: dipendenza vietata ${name}`);
  }
  for (const file of files(`${unit.path}/src`)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) specifier = node.arguments[0];
      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text;
        const local = name.startsWith('.');
        const pathFromSource = relative(resolve(unit.path, 'src'), resolve(dirname(file), name));
        const outside = local && (pathFromSource === '..' || pathFromSource.startsWith(`..${sep}`));
        if (outside || (!local && !allowed(name))) violations.push(`${file}: import vietato ${name}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else console.log('Confini verificati: core → nessuna dipendenza; adapter → core + alphaTab; UI → contratti pubblici.');
