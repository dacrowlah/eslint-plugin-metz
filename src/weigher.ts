// The state one file's parameter weighing reads (metz/max-params): the bag-name pattern, the types
// this file declares, the names being resolved (a cycle is uncountable instead of a hang), the type
// parameters in scope at the signature, and where an uncountable bag is reported.
import { AST_NODE_TYPES as AST, type TSESTree } from '@typescript-eslint/utils';

export const UNCOUNTABLE = -1;

type TypeDecl = TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration;
/** Every declaration of a name: an interface may be declared more than once (merging). */
export type Decls = readonly TypeDecl[];
export type Reporter = (type: TSESTree.Node) => void;

export type Weigher = {
  readonly bag: RegExp;
  readonly types: ReadonlyMap<string, Decls>;
  readonly visiting: Set<string>;
  /** Each type parameter in scope, with its constraint (`null` when it has none). */
  readonly bounds: ReadonlyMap<string, TSESTree.TypeNode | null>;
  readonly onUncountable: Reporter;
};

export const sum = (parts: number[]): number =>
  parts.includes(UNCOUNTABLE) ? UNCOUNTABLE : parts.reduce((a, b) => a + b, 0);
export const widest = (parts: number[]): number =>
  parts.includes(UNCOUNTABLE) ? UNCOUNTABLE : Math.max(...parts);

/** One name at a time: a cycle (`type A = A`, `T extends T`) is uncountable instead of a hang. */
export function resolving(w: Weigher, name: string, weigh: () => number): number {
  if (w.visiting.has(name)) return UNCOUNTABLE;
  w.visiting.add(name);
  const weight = weigh();
  w.visiting.delete(name);
  return weight;
}

const declarationOf = (stmt: TSESTree.ProgramStatement): TSESTree.Node | null =>
  stmt.type === AST.ExportNamedDeclaration ? stmt.declaration : stmt;
const isTypeDecl = (d: TSESTree.Node | null): d is TypeDecl =>
  d?.type === AST.TSInterfaceDeclaration || d?.type === AST.TSTypeAliasDeclaration;

/** Every interface and type alias the file declares at its top level, by name. */
export function topLevelTypes(program: TSESTree.Program): Map<string, Decls> {
  const map = new Map<string, Decls>();
  for (const d of program.body.map(declarationOf).filter(isTypeDecl))
    map.set(d.id.name, [...(map.get(d.id.name) ?? []), d]);
  return map;
}

type Generic = { typeParameters?: TSESTree.TSTypeParameterDeclaration | undefined };
const paramsOf = (n: TSESTree.Node): TSESTree.TSTypeParameter[] =>
  (n as Generic).typeParameters?.params ?? [];
const bound = (tp: TSESTree.TSTypeParameter): [string, TSESTree.TypeNode | null] => [
  tp.name.name,
  tp.constraint ?? null,
];

/** Every type parameter in scope at `node`, with its constraint (`null` when it has none): its
 * own, then each enclosing function's, class's or method's (`class C<P extends CardProps> {
 * m(p: P) }`); an inner one shadows an outer one, constrained or not. */
export function boundsAt(node: TSESTree.Node): Map<string, TSESTree.TypeNode | null> {
  const scopes: TSESTree.TSTypeParameter[][] = [];
  for (let n: TSESTree.Node | undefined = node; n; n = n.parent) scopes.push(paramsOf(n));
  return new Map(scopes.reverse().flat().map(bound));
}
