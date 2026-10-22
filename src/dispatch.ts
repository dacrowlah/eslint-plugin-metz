// Dispatch over node types through a handler table: the walks (jsx-flow.ts, the parameter weights)
// map each node type they follow to a handler, and every other type to a fallback.
import type { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

/** Handlers by node type, each taking its own kind of node. */
export type NodeHandlers<A extends unknown[], R> = {
  readonly [K in AST_NODE_TYPES]?: (node: Extract<TSESTree.Node, { type: K }>, ...args: A) => R;
};
type Handler<A extends unknown[], R> = (node: TSESTree.Node, ...args: A) => R;

/** The handler for the node's type applied to it, or `fallback` when the table has none. */
export function dispatch<A extends unknown[], R>(
  handlers: NodeHandlers<A, R>,
  node: TSESTree.Node,
  fallback: Handler<A, R>,
  ...args: A
): R {
  // The one cast: a table entry takes the node type it is keyed by, which is this node's.
  const handler = handlers[node.type] as Handler<A, R> | undefined;
  return (handler ?? fallback)(node, ...args);
}
