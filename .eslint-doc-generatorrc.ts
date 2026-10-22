// eslint-doc-generator keeps the README's rule list and each rule doc's header and options table in
// step with the rules' meta (`pnpm docs:generate`; `pnpm docs:check` fails on a stale doc). Its output is
// formatted with this repository's Prettier config, the tool's documented recipe, so the
// generated tables pass `pnpm format:check` as written.
import type { GenerateOptions } from 'eslint-doc-generator';
import { format, resolveConfig } from 'prettier';

const config: GenerateOptions = {
  configEmoji: [
    ['recommended', '✅'],
    ['strict', '🔒'],
    ['recommended-react', '⚛️'],
    ['strict-react', '🛡️'],
  ],
  ruleDocSectionInclude: ['Rule details', 'Options'],
  ruleListColumns: ['name', 'description', 'configsError', 'configsWarn', 'options'],
  urlConfigs: 'https://github.com/dacrowlah/eslint-plugin-metz#presets',
  postprocess: async (content, path) => {
    const options = await resolveConfig(path);
    return format(content, { ...options, filepath: path });
  },
};

export default config;
