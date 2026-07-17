import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cacheDirectory = join(tmpdir(), 'handoffos-widget-runtime');
const dependencyDirectory = resolve('node_modules');
const dependencyLink = join(cacheDirectory, 'node_modules');

mkdirSync(cacheDirectory, { recursive: true });

if (existsSync(dependencyLink)) {
  const isExpectedLink = lstatSync(dependencyLink).isSymbolicLink()
    && resolve(cacheDirectory, readlinkSync(dependencyLink)) === dependencyDirectory;

  if (!isExpectedLink) {
    throw new Error(`Refusing to replace unexpected cache dependency path: ${dependencyLink}`);
  }
}

if (!existsSync(dependencyLink)) {
  symlinkSync(dependencyDirectory, dependencyLink, 'dir');
}
