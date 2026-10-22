// How many parameters a parameter's type is, for metz/max-params: an inline type literal or a
// tuple one per member, a named option bag one per member of its declaration, and any other named
// type 1 (a parameter object). UNCOUNTABLE when a bag's keys cannot be known in this file.
import { AST_NODE_TYPES as AST, type TSESTree } from '@typescript-eslint/utils';
import { typeArg } from './component-props.ts';
import { dispatch, type NodeHandlers } from './dispatch.ts';
import { type Decls, resolving, sum, UNCOUNTABLE, type Weigher, widest } from './weigher.ts';

type TypeDecl = Decls[number];
/** A type reference by its name, its type arguments, and how it is written. */
type NamedRef = {
  readonly name: string;
  readonly args: TSESTree.TypeNode[];
  readonly typeName: TSESTree.EntityName;
};

/** Generic wrappers that keep the members of the bag they wrap. */
const TRANSPARENT = new Set([
  'Readonly',
  'Partial',
  'Required',
  'NonNullable',
  'PropsWithChildren',
  'PropsWithoutRef',
  'PropsWithRef',
]);
/** Utility types whose keys are at most those of the type they take first: they weigh as much as
 * it does (`Omit<CardProps, never>` is CardProps), except a `Pick` of literal keys, which weighs
 * one per key, and an `Omit` of literal keys, which weighs the rest (at least 1). */
const NARROWING = new Set(['Omit', 'Pick', 'Exclude', 'Extract']);
/** Members that add no keys to a union bag (`XProps | null`). */
const EMPTY = new Set<string>([AST.TSNullKeyword, AST.TSUndefinedKeyword, AST.TSNeverKeyword]);

/** One per member: a nested inline object is a single prop of the bag. A named bag with an index
 * signature has unknowable keys. */
const literalWeight = (members: TSESTree.TypeElement[]): number =>
  members.some((m) => m.type === AST.TSIndexSignature) ? UNCOUNTABLE : members.length;

/**
 * A named bag's literal must have countable keys, however it is wrapped: `Readonly<{ [k]: V }>`,
 * `{ a: A } & { [k]: V }` and unions weigh like the literal inside them, and `null`, `undefined`
 * and `never` in a union add no keys. Anything else (`typeof five`, `Holder['opts']`, `keyof X`,
 * a mapped or conditional type) has keys this file cannot count.
 */
const ALIAS: NodeHandlers<[Weigher], number> = {
  [AST.TSTypeLiteral]: (t) => literalWeight(t.members),
  [AST.TSIntersectionType]: (t, w) => sum(t.types.map((x) => aliasWeight(x, w))),
  [AST.TSUnionType]: (t, w) => widest(t.types.map((x) => aliasWeight(x, w))),
  [AST.TSTypeReference]: wrappedWeight,
};
const otherAlias = (t: TSESTree.Node): number => (EMPTY.has(t.type) ? 0 : UNCOUNTABLE);
const aliasWeight = (t: TSESTree.TypeNode, w: Weigher): number => dispatch(ALIAS, t, otherAlias, w);

/** Inside a bag: a wrapper weighs what it wraps, and a type declared in this file weighs like its
 * declaration (`Readonly<Dict>` with an index signature is uncountable). `Record`, an imported or
 * qualified type, or anything else declared elsewhere has keys this file cannot count. */
function wrappedWeight({ typeName, typeArguments }: TSESTree.TSTypeReference, w: Weigher): number {
  if (typeName.type !== AST.Identifier) return UNCOUNTABLE;
  const inner = typeArg(typeArguments, 0);
  if (TRANSPARENT.has(typeName.name) && inner) return aliasWeight(inner, w);
  return resolving(w, typeName.name, () => declsWeight(w.types.get(typeName.name), w));
}

function declWeight(decl: TypeDecl, w: Weigher): number {
  if (decl.type === AST.TSTypeAliasDeclaration) return aliasWeight(decl.typeAnnotation, w);
  return decl.extends.length > 0 ? UNCOUNTABLE : literalWeight(decl.body.body);
}

/** A merged interface weighs the members of all its declarations. */
export const declsWeight = (decls: Decls | undefined, w: Weigher): number =>
  decls ? sum(decls.map((d) => declWeight(d, w))) : UNCOUNTABLE;

/** The keys a `Pick`/`Omit` names: each member of a union, or the one type. */
function keysOf(keys: TSESTree.TypeNode | undefined): TSESTree.TypeNode[] {
  if (!keys) return [];
  return keys.type === AST.TSUnionType ? keys.types : [keys];
}

/** How many keys are named, when every one is a literal; otherwise null. */
function literalKeys(keys: TSESTree.TypeNode | undefined): number | null {
  const literals = keysOf(keys);
  const named = literals.length > 0 && literals.every((k) => k.type === AST.TSLiteralType);
  return named ? literals.length : null;
}

/** An `Omit` of literal keys weighs the rest, at least 1; of anything else, the whole. */
const omitted = (whole: number, count: number | null): number =>
  count === null || whole === UNCOUNTABLE ? whole : Math.max(whole - count, 1);

/** `Pick<B, 'a' | 'b'>` weighs its literal keys; any other narrowing weighs what it narrows. */
function narrowedWeight({ name, args: [base, keys] }: NamedRef, w: Weigher): number {
  const count = literalKeys(keys);
  if (name === 'Pick' && count !== null) return count;
  const whole = base ? typeWeight(base, w) : 1;
  return name === 'Omit' ? omitted(whole, count) : whole;
}

/** A named option bag declared in this file weighs its members; any other name weighs 1. */
function namedWeight(ref: NamedRef, w: Weigher): number {
  if (!w.bag.test(ref.name)) return 1;
  if (ref.typeName.type !== AST.Identifier) return UNCOUNTABLE;
  return resolving(w, ref.name, () => declsWeight(w.types.get(ref.name), w));
}

/** A type parameter weighs as its constraint; an unconstrained one (`null`) weighs 1. */
function boundWeight(ref: NamedRef, w: Weigher): number {
  const constraint = ref.typeName.type === AST.Identifier ? w.bounds.get(ref.name) : undefined;
  if (constraint) return resolving(w, ref.name, () => typeWeight(constraint, w));
  return constraint === null ? 1 : namedWeight(ref, w);
}

function namedRefWeight(ref: NamedRef, w: Weigher): number {
  const [inner] = ref.args;
  if (TRANSPARENT.has(ref.name) && inner) return typeWeight(inner, w);
  return NARROWING.has(ref.name) ? narrowedWeight(ref, w) : boundWeight(ref, w);
}

function referenceWeight(ref: TSESTree.TSTypeReference, w: Weigher): number {
  const { typeName } = ref;
  if (typeName.type === AST.ThisExpression) return 1;
  const id = typeName.type === AST.TSQualifiedName ? typeName.right : typeName;
  const args = ref.typeArguments?.params ?? [];
  return namedRefWeight({ name: id.name, args, typeName }, w);
}

const TYPES: NodeHandlers<[Weigher], number> = {
  [AST.TSTypeLiteral]: (t) => t.members.length, // an inline dictionary (`{ [k: string]: Json }`) is one member
  [AST.TSMappedType]: () => UNCOUNTABLE,
  [AST.TSTypeReference]: referenceWeight,
  [AST.TSIntersectionType]: (t, w) => sum(t.types.map((x) => typeWeight(x, w))),
  [AST.TSUnionType]: (t, w) => widest(t.types.map((x) => typeWeight(x, w))),
  [AST.TSTupleType]: (t) => t.elementTypes.length,
  [AST.TSTypeOperator]: (t, w) =>
    t.operator === 'readonly' && t.typeAnnotation ? typeWeight(t.typeAnnotation, w) : 1,
};

export const typeWeight = (t: TSESTree.TypeNode, w: Weigher): number =>
  dispatch(TYPES, t, () => 1, w);
