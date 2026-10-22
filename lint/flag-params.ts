// No boolean flag parameters (The Wrong Abstraction), in every spelling selectors can see.
// A parameter type is followed through TRANSPARENT_STEPS (wrappers, unions, intersections, tuples,
// inline literals) down to a boolean, up to MAX_TYPE_DEPTH nodes deep. Arrays, function types and
// names declared elsewhere are not followed.
import { BAG_SUFFIXES } from '../src/bags.ts';
import { tagged } from './tag.ts';

const MESSAGE =
  'No boolean flag parameters (The Wrong Abstraction). Write two functions or pass a polymorphic object.';
const flag = (id: string, selector: string) => ({
  selector,
  message: tagged(`flag/${id}`, MESSAGE),
});

/** Every node that declares parameters. */
export const SIGNATURE_KINDS = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
  'TSFunctionType',
  'TSConstructorType',
  'TSMethodSignature',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
];
const SIGNATURE = `:matches(${SIGNATURE_KINDS.join(', ')})`;

/** Named option bags: one list, shared with metz/max-params (its home is the plugin's
 * `src/bags.ts`). A boolean in `*Props` is a normal component prop, so it is not listed; a boolean
 * field of a `*Config` or `*Settings` parameter is a review item (those names are data types too). */
const NAMED_BAG = `/(${BAG_SUFFIXES.join('|')})$/`;

/** Type nodes a boolean can sit behind and still be a flag. */
export const TRANSPARENT_STEPS = [
  'TSTypeReference:not([typeName.name=/^(Array|ReadonlyArray)$/])',
  'TSTypeParameterInstantiation',
  'TSUnionType',
  'TSIntersectionType',
  "TSTypeOperator[operator='readonly']",
  'TSTupleType',
  'TSNamedTupleMember',
  'TSOptionalType',
  'TSTypeLiteral',
  'TSPropertySignature',
  'TSIndexSignature',
  'TSTypeAnnotation',
  'TSInterfaceBody',
  'TSInterfaceHeritage',
];
export const MAX_TYPE_DEPTH = 12;
const STEP = `:matches(${TRANSPARENT_STEPS.join(', ')})`;

// Where a parameter's declared type, a named bag's body, or a generic's constraint starts.
const PARAM_ID = 'Identifier > TSTypeAnnotation';
const TYPE_ROOTS: Record<string, string> = {
  param: `${SIGNATURE} > ${PARAM_ID}`,
  'param-default': `${SIGNATURE} > AssignmentPattern > ${PARAM_ID}`,
  'object-pattern': `${SIGNATURE} > ObjectPattern > TSTypeAnnotation`,
  'array-pattern': `${SIGNATURE} > ArrayPattern > TSTypeAnnotation`,
  'object-pattern-default': `${SIGNATURE} > AssignmentPattern > ObjectPattern > TSTypeAnnotation`,
  'array-pattern-default': `${SIGNATURE} > AssignmentPattern > ArrayPattern > TSTypeAnnotation`,
  rest: `${SIGNATURE} > RestElement > TSTypeAnnotation`,
  'param-property': `${SIGNATURE} > TSParameterProperty > ${PARAM_ID}`,
  'param-property-default': `${SIGNATURE} > TSParameterProperty > AssignmentPattern > ${PARAM_ID}`,
  'named-bag': `TSTypeAliasDeclaration[id.name=${NAMED_BAG}]`,
  'named-interface': `TSInterfaceDeclaration[id.name=${NAMED_BAG}]`,
  generic: 'TSTypeParameter',
};

const TRUE_AND_FALSE =
  "TSUnionType:has(> TSLiteralType[literal.raw='true']):has(> TSLiteralType[literal.raw='false'])";
const BOOL_LITERAL = 'Literal[raw=/^(true|false)$/]';
/** At any depth: `boolean`, or a union with both `true` and `false`. */
const LEAVES = ['TSBooleanKeyword', TRUE_AND_FALSE];

const pathsOf = (root: string): string[] =>
  Array.from({ length: MAX_TYPE_DEPTH + 1 }, (_, depth) => [
    root,
    ...Array<string>(depth).fill(STEP),
  ])
    .flatMap((path) => LEAVES.map((leaf) => [...path, leaf].join(' > ')))
    .concat(`${root} > TSLiteralType > ${BOOL_LITERAL}`); // `(x: true)` directly, not a nested discriminant

const ROOT_BANS = Object.entries(TYPE_ROOTS).flatMap(([id, root]) =>
  pathsOf(root).map((selector) => flag(id, selector)),
);
const ARRAY_OF_BOOLEAN: Record<string, string> = {
  'rest-array': 'TSArrayType > TSBooleanKeyword',
  'rest-readonly-array': 'TSTypeOperator > TSArrayType > TSBooleanKeyword',
  'rest-generic-array':
    'TSTypeReference[typeName.name=/^(Array|ReadonlyArray)$/] > TSTypeParameterInstantiation > TSBooleanKeyword',
};

// `= true` / `= false` defaults: on a parameter, a parameter property, or inside destructuring
// (`({ on = false } = {})`, `([on = false])`), with or without a default for the whole pattern.
const DEFAULTED: Record<string, string> = {
  'default-literal': `${SIGNATURE} > AssignmentPattern`,
  'param-property-default-literal': 'TSParameterProperty > AssignmentPattern',
  'object-pattern-default-literal': `${SIGNATURE} > ObjectPattern AssignmentPattern`,
  'array-pattern-default-literal': `${SIGNATURE} > ArrayPattern AssignmentPattern`,
  'defaulted-object-pattern-default-literal': `${SIGNATURE} > AssignmentPattern > ObjectPattern AssignmentPattern`,
  'defaulted-array-pattern-default-literal': `${SIGNATURE} > AssignmentPattern > ArrayPattern AssignmentPattern`,
};

export const FLAG_PARAM_BANS = [
  ...ROOT_BANS,
  ...Object.entries(ARRAY_OF_BOOLEAN).map(([id, shape]) =>
    flag(id, `${SIGNATURE} > RestElement > TSTypeAnnotation > ${shape}`),
  ),
  ...Object.entries(DEFAULTED).map(([id, at]) => flag(id, `${at} > ${BOOL_LITERAL}`)),
  // Aliases of any name: `boolean`, `true | false` and two-member unions. Wider unions are allowed
  // because the recursive `Json` type contains boolean.
  flag('alias', 'TSTypeAliasDeclaration > TSBooleanKeyword'),
  flag('alias-pair', 'TSTypeAliasDeclaration > TSUnionType[types.length=2] > TSBooleanKeyword'),
  flag('alias-true-false', `TSTypeAliasDeclaration > ${TRUE_AND_FALSE}`),
];
