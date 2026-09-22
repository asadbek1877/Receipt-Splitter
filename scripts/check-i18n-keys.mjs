import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const localesDir = path.resolve(process.cwd(), 'src/shared/config/locales');

const flattenKeys = (value, prefix = '') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child, nextPrefix);
    }
    return [nextPrefix];
  });
};

const localeFiles = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith('.json'))
  .sort();

if (localeFiles.length === 0) {
  console.error(`No locale JSON files found in ${localesDir}`);
  process.exit(1);
}

const dictionaries = new Map(
  localeFiles.map((file) => {
    const fullPath = path.join(localesDir, file);
    return [file, JSON.parse(fs.readFileSync(fullPath, 'utf8'))];
  }),
);

const keysByFile = new Map(
  [...dictionaries.entries()].map(([file, dictionary]) => [
    file,
    new Set(flattenKeys(dictionary)),
  ]),
);

const allKeys = new Set([...keysByFile.values()].flatMap((keys) => [...keys]));
let hasMissingKeys = false;

for (const [file, keys] of keysByFile.entries()) {
  const missing = [...allKeys].filter((key) => !keys.has(key)).sort();
  if (missing.length === 0) continue;

  hasMissingKeys = true;
  console.error(`\n${file} is missing ${missing.length} key(s):`);
  missing.forEach((key) => console.error(`  - ${key}`));
}

if (hasMissingKeys) {
  console.error('\nLocale dictionaries are not aligned.');
  process.exit(1);
}

console.log(`All ${localeFiles.length} locale dictionaries are aligned (${allKeys.size} keys).`);
