// The props type a component function is given by its context, for metz/max-params:
// `const Card: FC<CardProps> = (p) => ...`, through `memo(...)` too, `memo<CardProps>(...)`,
// `((p) => ...) satisfies FC<CardProps>` (or `as`), and `forwardRef<Ref, CardProps>((p, ref) => ...)`.
import { AST_NODE_TYPES as AST, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from './ast.ts';
import { dispatch, type NodeHandlers } from './dispatch.ts';

type Props = TSESTree.TypeNode | undefined;

/** Component types whose first type argument types the first parameter of the function they hold
 * (`const Card: FC<CardProps> = (p) => ...`). */
const COMPONENT_TYPES = new Set([
  'FC',
  'FunctionComponent',
  'VFC',
  'VoidFunctionComponent',
  'ComponentType',
]);

/** A type argument of a generic call or type, by position. */
export const typeArg = (
  args: TSESTree.TSTypeParameterInstantiation | undefined,
  at: number,
): TSESTree.TypeNode | undefined => args?.params[at];

/** A reference's name, or the right of a qualified name (a component's type is never `this`). */
function refName({ typeName }: TSESTree.TSTypeReference): string {
  const id = typeName.type === AST.TSQualifiedName ? typeName.right : typeName;
  return (id as TSESTree.Identifier).name;
}

/** The props a component type names: `FC<CardProps>` or `React.FC<CardProps>` gives CardProps. */
function propsOf(t: TSESTree.TypeNode | undefined): Props {
  if (t?.type !== AST.TSTypeReference) return undefined;
  return COMPONENT_TYPES.has(refName(t)) ? typeArg(t.typeArguments, 0) : undefined;
}

/** A call that wraps a component and hands it on: `memo(fn)`. */
const isMemo = (n: TSESTree.CallExpression, child: TSESTree.Node): boolean =>
  n.arguments[0] === child && calleeName(n.callee) === 'memo';

/** `forwardRef<Ref, CardProps>(...)` names the props second; `memo<CardProps>(...)` names them
 * itself, and a `memo(...)` without them takes them from its own context. */
function callProps(n: TSESTree.CallExpression, child: TSESTree.Node): Props {
  if (calleeName(n.callee) === 'forwardRef') return typeArg(n.typeArguments, 1);
  if (!isMemo(n, child)) return undefined;
  return typeArg(n.typeArguments, 0) ?? componentProps(n);
}

const PROPS: NodeHandlers<[TSESTree.Node], Props> = {
  [AST.CallExpression]: callProps,
  [AST.TSSatisfiesExpression]: (n) => propsOf(n.typeAnnotation),
  [AST.TSAsExpression]: (n) => propsOf(n.typeAnnotation),
  [AST.VariableDeclarator]: (n) => propsOf(n.id.typeAnnotation?.typeAnnotation),
};

/** The props type `child`'s context gives it, looking up from its parent. */
export function componentProps(child: TSESTree.Node): Props {
  const n = child.parent;
  return n ? dispatch(PROPS, n, () => undefined, child) : undefined;
}
