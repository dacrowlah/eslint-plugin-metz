// Parameter weights for metz/max-params: how many "parameters" a function parameter really is.
// Positional parameters weigh 1; destructured keys, inline type literal members, tuple elements and
// option/props bag members weigh one each (type-weight.ts). UNCOUNTABLE means the bag's keys cannot
// be known here.
import { AST_NODE_TYPES as AST, type TSESTree } from '@typescript-eslint/utils';
import type { Sig } from './ast.ts';
import { componentProps } from './component-props.ts';
import { dispatch, type NodeHandlers } from './dispatch.ts';
import { typeWeight } from './type-weight.ts';
import {
  boundsAt,
  type Reporter,
  sum,
  topLevelTypes,
  UNCOUNTABLE,
  type Weigher,
} from './weigher.ts';

export { UNCOUNTABLE } from './weigher.ts';
export type { Reporter } from './weigher.ts';

/** What a signature's parameter can be wrapped in. */
const WRAPPED_PARAMS = new Set<string>([AST.AssignmentPattern, AST.TSParameterProperty]);

function valueWeight(v: TSESTree.Node): number {
  if (v.type === AST.AssignmentPattern) return valueWeight(v.left);
  return Math.max(patternWeight(v), 1);
}
const propertyWeight = (x: TSESTree.Property | TSESTree.RestElement): number =>
  x.type === AST.Property ? valueWeight(x.value) : 1;
const elementWeight = (x: TSESTree.DestructuringPattern | null): number => (x ? valueWeight(x) : 1);

/** Destructured keys (nested too) and array elements count one each. */
function patternWeight(p: TSESTree.Node): number {
  if (p.type === AST.ObjectPattern) return sum(p.properties.map(propertyWeight));
  return p.type === AST.ArrayPattern ? sum(p.elements.map(elementWeight)) : 0;
}

/** A rest parameter typed as a tuple, `readonly` or not, weighs its elements; any other weighs 1
 * (typeWeight weighs the tuple through `readonly`, and any other type operator as 1). */
function restWeight(p: TSESTree.RestElement, w: Weigher): number {
  const annotation = p.typeAnnotation?.typeAnnotation;
  return annotation && isTuple(annotation) ? typeWeight(annotation, w) : 1;
}
const isTuple = (t: TSESTree.TypeNode): boolean =>
  (t.type === AST.TSTypeOperator ? t.typeAnnotation : t)?.type === AST.TSTupleType;

/** The props type a component annotation gives the first parameter of the function it holds:
 * `const Card: FC<CardProps> = (p) => ...` weighs `p` as CardProps. Any other untyped parameter
 * weighs 1. The parameter as the signature lists it: a defaulted one (`p = x`) sits in a pattern,
 * and a constructor's parameter property (`private p = x`) wraps both. */
function contextual(p: TSESTree.Node, w: Weigher): number {
  let top = p;
  while (top.parent && WRAPPED_PARAMS.has(top.parent.type)) top = top.parent;
  const fn = top.parent as Sig;
  const props = fn.params[0] === top ? componentProps(fn) : undefined;
  return props ? typeWeight(props, w) : 1;
}

const annotationOf = (p: TSESTree.Node): TSESTree.TypeNode | undefined =>
  p.type === AST.Identifier || p.type === AST.ObjectPattern || p.type === AST.ArrayPattern
    ? p.typeAnnotation?.typeAnnotation
    : undefined;

/** A named or destructured parameter: its type's weight, or its context's, and at least its
 * destructured keys. An uncountable bag is reported. */
function typedWeight(p: TSESTree.Node, w: Weigher): number {
  const annotation = annotationOf(p);
  const typed = annotation ? typeWeight(annotation, w) : contextual(p, w);
  if (typed === UNCOUNTABLE && annotation) w.onUncountable(annotation);
  return Math.max(typed, patternWeight(p), 1);
}

const PARAMS: NodeHandlers<[Weigher], number> = {
  [AST.TSParameterProperty]: (p, w) => paramWeight(p.parameter, w),
  [AST.AssignmentPattern]: (p, w) => paramWeight(p.left, w),
  [AST.Identifier]: (p, w) => (p.name === 'this' ? 0 : typedWeight(p, w)),
  [AST.RestElement]: restWeight,
};

const paramWeight = (p: TSESTree.Node, w: Weigher): number => dispatch(PARAMS, p, typedWeight, w);

type Shared = Omit<Weigher, 'bounds' | 'onUncountable'>;

/** Total weight of a signature's parameters; reports every uncountable bag it meets. */
function weighed(sig: Sig, onUncountable: Reporter, shared: Shared): number {
  const w: Weigher = { ...shared, bounds: boundsAt(sig), onUncountable };
  return sum(sig.params.map((p) => Math.max(paramWeight(p, w), 0)));
}

/** A weigher for one file: bags named by `bagPattern`, declared in `program`. */
export function createWeigher(bagPattern: string, program: TSESTree.Program) {
  const shared = {
    bag: new RegExp(bagPattern),
    types: topLevelTypes(program),
    visiting: new Set<string>(),
  };
  return (sig: Sig, onUncountable: Reporter): number => weighed(sig, onUncountable, shared);
}
