// The single definition of a "counted line" (CL). See CLAUDE.md "Counted lines".
//
// A physical line (as formatted by Prettier) is COUNTED when it holds at least one token that is
//   - not a comment (comments are never tokens here),
//   - not a closing / separator punctuator: } ) ] ; , > /   (so "});", "/>", ">" alone do not count),
//   - not part of a JSX closing tag (</View>, </>),
//   - not part of an import / re-export declaration (file level only).
// Blank lines contain no tokens, so they never count. Multi-line tokens (template literals,
// JSX text) count each of their non-blank lines.
import { AST_TOKEN_TYPES, type TSESTree } from '@typescript-eslint/utils';

const CLOSERS = new Set(['}', ')', ']', ';', ',', '>', '/']);

export type SkipSet = Set<number>; // token start offsets that never count

export function markSkipped(skip: SkipSet, tokens: readonly TSESTree.Token[]): void {
  for (const t of tokens) skip.add(t.range[0]);
}

function isCountable(t: TSESTree.Token, skip: SkipSet): boolean {
  if (skip.has(t.range[0])) return false;
  return !(t.type === AST_TOKEN_TYPES.Punctuator && CLOSERS.has(t.value));
}

function addTokenLines(lines: Set<number>, t: TSESTree.Token): void {
  t.value.split('\n').forEach((segment, i) => {
    if (segment.trim() !== '') lines.add(t.loc.start.line + i);
  });
}

export function countedLines(tokens: readonly TSESTree.Token[], skip: SkipSet): number {
  const lines = new Set<number>();
  for (const t of tokens) if (isCountable(t, skip)) addTokenLines(lines, t);
  return lines.size;
}
