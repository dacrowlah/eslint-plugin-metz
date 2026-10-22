// The listeners of metz/screen-view-model: a screen calls exactly one hook, its view-model hook,
// binds it to one name (or destructures it one level deep), and only passes its slices on, calls
// them, or hands the whole view model to its own view. Reach-through is view-model-reach.ts.
import { AST_NODE_TYPES as AST, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { type Fn, fnName, isModuleLevel } from './ast.ts';
import { hookName } from './hooks.ts';
import { functionHandlers, type Handlers, listen, popFrame } from './listen.ts';
import { baseName, isPascal } from './names.ts';
import { memberOf, reachesThrough, reportReach, type Reporting } from './view-model-reach.ts';

type Naming = { screenSuffix: string; viewSuffix: string };
export type ScreenSettings = Naming & { viewModelPattern: string };
type Options = [Partial<ScreenSettings>];
export type MessageIds =
  'exactlyOne' | 'notViewModel' | 'binding' | 'reachThrough' | 'spread' | 'wholeViewModel';
type Hook = { readonly call: TSESTree.CallExpression; readonly name: string };
type Frame = { readonly fn: Fn; readonly hooks: Hook[] };
type Screen = Reporting & {
  readonly context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
  readonly settings: ScreenSettings;
  readonly pattern: RegExp;
  readonly stack: Frame[];
};
/** How a screen binds its view model, and the screen's name. */
type Binding = { readonly destructured: boolean; readonly screen: string };

/** The view a screen may pass its whole view model to, its name without the screen suffix plus
 * the view suffix: RaceScreen (or Race) -> RaceView. */
function viewOf(screen: string, { screenSuffix, viewSuffix }: Naming): string {
  const suffixed = screen.endsWith(screenSuffix);
  const base = suffixed ? screen.slice(0, screen.length - screenSuffix.length) : screen;
  return `${base}${viewSuffix}`;
}

/** `typeof vm` and `typeof vm.board` in a type position are not uses of the view model. */
const inTypeQuery = (n: TSESTree.Node): boolean =>
  n.type === AST.TSTypeQuery || (n.type === AST.TSQualifiedName && inTypeQuery(n.parent));

const isShallowPattern = (id: TSESTree.Node): boolean =>
  id.type === AST.Identifier ||
  (id.type === AST.ObjectPattern &&
    id.properties.every((p) => p.type === AST.Property && p.value.type === AST.Identifier));

/** The view model as a JSX attribute's value. */
const isAttributeValue = (p: TSESTree.Node): p is TSESTree.JSXExpressionContainer =>
  p.type === AST.JSXExpressionContainer && p.parent.type === AST.JSXAttribute;

/** The whole view model as a JSX attribute value: only the screen's own view takes it. */
function checkWhole(container: TSESTree.JSXExpressionContainer, screen: string, s: Screen): void {
  const opening = (container.parent as TSESTree.JSXAttribute).parent;
  const data = { name: s.source.getText(opening.name), view: viewOf(screen, s.settings) };
  if (data.name !== data.view)
    s.context.report({ node: container, messageId: 'wholeViewModel', data });
}

/** A use of the view model: a slice (`vm.x`, `vm.x()`, or a destructured one), the screen's
 * view's `vm`, or anything else, which reaches through it. */
function checkUse(id: TSESTree.Identifier, b: Binding, s: Screen): void {
  const slice = b.destructured ? id : memberOf(id);
  if (slice) reachesThrough(slice, s);
  else if (isAttributeValue(id.parent)) checkWhole(id.parent, b.screen, s);
  else reportReach(id, s);
}

/** The view model may only appear as `vm.x`, `vm.x()`, or as the screen's view's `vm`. */
function checkReference(id: TSESTree.Identifier, b: Binding, s: Screen): void {
  const p = id.parent;
  if (inTypeQuery(p)) return;
  if (p.type === AST.JSXSpreadAttribute) s.context.report({ node: p, messageId: 'spread' });
  else checkUse(id, b, s);
}

function checkReads(decl: TSESTree.VariableDeclarator, b: Binding, s: Screen): void {
  const refs = s.source.getDeclaredVariables(decl).flatMap((v) => v.references);
  for (const ref of refs.filter((r) => r.isRead()))
    checkReference(ref.identifier as TSESTree.Identifier, b, s);
}

function checkBinding(call: TSESTree.CallExpression, screen: string, s: Screen): void {
  const decl = call.parent;
  if (decl.type !== AST.VariableDeclarator || !isShallowPattern(decl.id))
    s.context.report({ node: call, messageId: 'binding' });
  else checkReads(decl, { destructured: decl.id.type === AST.ObjectPattern, screen }, s);
}

function checkHook({ call, name: hook }: Hook, name: string, s: Screen): void {
  const data = { name, hook, pattern: s.settings.viewModelPattern };
  if (s.pattern.test(hook)) checkBinding(call, name, s);
  else s.context.report({ node: call, messageId: 'notViewModel', data });
}

/** A screen calls exactly one hook. An anonymous screen goes by its file's name
 * (`RaceScreen.tsx` -> `RaceScreen`): at module level only a default export can be anonymous. */
function checkScreen({ fn, hooks }: Frame, s: Screen): void {
  const name = fnName(fn) ?? baseName(s.context.filename);
  const [hook, ...others] = hooks;
  const data = { name, n: hooks.length };
  if (!hook || others.length > 0) s.context.report({ node: fn, messageId: 'exactlyOne', data });
  else checkHook(hook, name, s);
}

const HANDLERS: Handlers<Screen> = {
  ...functionHandlers<Screen>(
    (fn, s) => s.stack.push({ fn, hooks: [] }),
    (_, s) => {
      const frame = popFrame(s.stack);
      const name = fnName(frame.fn);
      if (isModuleLevel(frame.fn) && (name === null || isPascal(name))) checkScreen(frame, s);
    },
  ),
  CallExpression: (call: TSESTree.CallExpression, s: Screen) => {
    const name = hookName(call, s.source.getScope(call));
    if (name) s.stack.at(-1)?.hooks.push({ call, name });
  },
};

type Context = Readonly<TSESLint.RuleContext<MessageIds, Options>>;

/** The listeners for one file, under `settings`. */
export function screenListeners(context: Context, settings: ScreenSettings): TSESLint.RuleListener {
  const pattern = new RegExp(settings.viewModelPattern);
  const reported = new Set<TSESTree.Node>();
  const source = context.sourceCode;
  return listen(HANDLERS, { context, source, settings, pattern, stack: [], reported });
}
