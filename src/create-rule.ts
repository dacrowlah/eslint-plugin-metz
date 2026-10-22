// Every rule is built here, so each gets its documentation URL (typescript-eslint's RuleCreator,
// as its "Custom Rules" guide recommends) and the same docs shape.
import { ESLintUtils } from '@typescript-eslint/utils';
import { docsUrl } from './package-info.ts';

export type MetzDocs = { readonly description: string };

export const createRule = ESLintUtils.RuleCreator<MetzDocs>(docsUrl);
