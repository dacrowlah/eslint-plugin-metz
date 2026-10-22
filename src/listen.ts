// Rule listeners from a table of handlers. A rule keeps its state in one object and maps each
// selector to a module-level handler of `(node, state)`, so no listener is a closure over `create`.
import type { TSESLint } from '@typescript-eslint/utils';
import { FN_SELECTORS, type Fn } from './ast.ts';

/** A handler takes the node its selector matches, and the rule's state. */
export type Handler<S> = (node: never, state: S) => void;
export type Handlers<S> = Readonly<Record<string, Handler<S>>>;

const bound =
  <S>(handler: Handler<S>, state: S) =>
  (node: never): void => {
    handler(node, state);
  };

/** ESLint listeners that hand each node, with `state`, to the handler of its selector. */
export const listen = <S>(handlers: Handlers<S>, state: S): TSESLint.RuleListener =>
  Object.fromEntries(Object.entries(handlers).map(([sel, h]) => [sel, bound(h, state)]));

/** One handler on entering every kind of function node, and one on leaving it: the rules keep a
 * stack of the functions they are in. */
export const functionHandlers = <S>(
  enter: (fn: Fn, state: S) => void,
  exit: (fn: Fn, state: S) => void,
): Handlers<S> =>
  Object.fromEntries(
    FN_SELECTORS.flatMap((sel) => [
      [sel, enter],
      [`${sel}:exit`, exit],
    ]),
  );

/** The frame of the function being left: every exit follows its enter, so one is on the stack. */
export function popFrame<F>(stack: F[]): F {
  const frame = stack.pop();
  return frame as F;
}
