// The plugin's name, version and home, read from its own package.json (ESLint's "Create Plugins"
// guide recommends taking meta.name and meta.version from it), so a release bumps one file. The
// manifest sits one level above this module both in src/ and in the built dist/.
import { readFileSync } from 'node:fs';

type Manifest = { readonly name: string; readonly version: string; readonly homepage: string };

const text = readFileSync(new URL('../package.json', import.meta.url)).toString();
const parsed: unknown = JSON.parse(text);
export const MANIFEST = parsed as Manifest;

/** The repository's web address: the manifest's homepage without its `#readme` anchor. */
const home = new URL(MANIFEST.homepage);
home.hash = '';
const REPOSITORY = home.href;

/** A rule's documentation, at the tag of the version that is installed. */
export const docsUrl = (rule: string): string =>
  `${REPOSITORY}/blob/v${MANIFEST.version}/docs/rules/${rule}.md`;
