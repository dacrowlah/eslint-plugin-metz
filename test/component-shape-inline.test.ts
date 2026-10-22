import rule from '../src/rules/component-shape.ts';
import { ruleTester, tsx } from './setup.ts';

// M8's one exception, an inline JSX arrow passed straight to a non-hook call or prop: also as an
// object-property value of a JSX attribute or of a call argument (Expo Router options, a test
// wrapper), and with a body that only chooses between JSX (`?:`, `&&`). JSX that flows out
// through an object, a nested pattern or `Array.of` is still JSX; a number read off it is not.
const component = (body: string) => tsx(`export function Card() { ${body} }`);
const helper = (name: string) => [{ messageId: 'renderHelper' as const, data: { name } }];

ruleTester.run('component-shape (inline)', rule, {
  valid: [
    component('return <Stack screenOptions={{ headerRight: () => <Btn /> }} />;'),
    component(
      'return <Tabs.Screen options={{ tabBarIcon: ({ color }) => <Icon color={color} /> }} />;',
    ),
    component(
      'const nav = useNav(); nav.setOptions({ headerRight: () => <Btn /> }); return <V />;',
    ),
    tsx('renderHook(() => useX(), { wrapper: ({ children }) => <P>{children}</P> });'),
    component('return <V onPress={() => toast.custom((t) => <Toast t={t} />)} />;'),
    // An inline arrow, or the options object, chosen by `?:`, `??` or `||`: React Navigation keeps
    // its default header button when the choice is `undefined`.
    component(
      'return <Stack screenOptions={{ headerRight: vm.canEdit ? () => <Edit /> : undefined }} />;',
    ),
    component(
      'return <List renderItem={vm.grid ? ({ item }) => <Cell c={item} /> : ({ item }) => <Row r={item} />} />;',
    ),
    component(
      'return <Stack.Screen options={({ route }) => (route.params.modal ? { headerLeft: () => <Close /> } : { headerRight: () => <Btn /> })} />;',
    ),
    component('return <Stack screenOptions={{ headerRight: vm.right ?? (() => <Btn />) }} />;'),
    // An optional key spread into the options object keeps the base's value otherwise.
    component(
      'return <Stack screenOptions={{ ...vm.base, ...(vm.modal ? { headerLeft: () => <Close /> } : {}) }} />;',
    ),
    // The `&&` form of an optional key: a falsy left spreads nothing.
    component(
      'return <Stack screenOptions={{ ...vm.base, ...(vm.modal && { headerLeft: () => <Close /> }) }} />;',
    ),
    // A handler storing an element in a ref stores it, it hands nothing back.
    component('return <V onPress={() => (ref.current = <W />)} />;'),
    // The block-body form: the object is the arrow's only return.
    component(
      'return <Stack.Screen options={({ route }) => {\n  return { title: route.name, headerRight: () => <Btn /> };\n}} />;',
    ),
    // React Navigation's function-form options: the object is the body of the arrow handed over.
    component(
      'return <Stack.Screen options={({ route }) => ({ title: route.name, headerRight: () => <Btn /> })} />;',
    ),
    component('return <List renderItem={({ item }) => (item.ok ? <Row /> : <Empty />)} />;'),
    component('return <List renderItem={({ item }) => item.ok && <Row />} />;'),
    component('return <List renderItem={({ item }) => (item.ok ? <Row /> : null)} />;'),
    component('return <List renderItem={({ item }) => (item.ok ? <Row /> : undefined)} />;'),
    tsx('export function count() { return [<A key="a" />, <B key="b" />].length; }'),
    tsx('export function count(xs: X[]) { return xs.map((x) => <Row key={x} />).length; }'),
  ],
  invalid: [
    // A fragment is JSX like an element.
    { ...tsx('export function f() { return <></>; }'), errors: helper('f') },
    // Only an arrow hands its returned object over: a function expression's object is its own.
    {
      ...component(
        'return <Stack.Screen options={function () {\n  return { headerRight: () => <Btn /> };\n}} />;',
      ),
      errors: helper('headerRight'),
    },
    { ...tsx('export function f() { return { el: <V /> }.el; }'), errors: helper('f') },
    {
      ...tsx('export function f() { const o = { el: <V /> }; return o.el; }'),
      errors: helper('f'),
    },
    {
      ...tsx('export function f() { const { a: { el } } = { a: { el: <V /> } }; return el; }'),
      errors: helper('f'),
    },
    { ...tsx('export function f() { return Array.of(<V />); }'), errors: helper('f') },
    { ...tsx('export function f() { return [<V />]?.[0]; }'), errors: helper('f') },
    {
      ...component('const cb = useCallback; const r = cb(() => <Row />, []); return <V>{r}</V>;'),
      errors: helper('(anonymous)'),
    },
    {
      ...component('const m = useMemo(() => ({ x: () => <V /> }), []); return <W m={m} />;'),
      errors: helper('x'),
    },
    { ...tsx('export const o = { render: () => <V /> };'), errors: helper('render') },
    {
      ...component('return <List renderItem={({ item }) => (item.ok ? build(item) : <Row />)} />;'),
      errors: helper('(anonymous)'),
    },
    { ...component('return <V>{(() => <W />)()}</V>;'), errors: helper('(anonymous)') },
    // `||` can hand back its left operand, which is not JSX.
    {
      ...component('return <List renderItem={({ item }) => item.row || <Row />} />;'),
      errors: helper('(anonymous)'),
    },
    // A branch that is a value, not nothing.
    {
      ...component(
        'return <List renderItem={({ item, other }) => (item.ok ? <Row /> : other)} />;',
      ),
      errors: helper('(anonymous)'),
    },
    // A choice not handed over: at module level, as a hook's argument, after `&&`, or on the left
    // of `||`.
    {
      ...tsx('export const f = ok ? () => <A /> : () => <B />;'),
      errors: [...helper('(anonymous)'), ...helper('(anonymous)')],
    },
    {
      ...component('const r = useCallback(ok ? () => <V /> : x, []);\nreturn <W r={r} />;'),
      errors: helper('(anonymous)'),
    },
    { ...component('return <W r={ok && (() => <V />)} />;'), errors: helper('(anonymous)') },
    { ...component('return <W r={(() => <V />) || x} />;'), errors: helper('(anonymous)') },
    { ...component('return <W r={(() => <V />) ? a : b} />;'), errors: helper('(anonymous)') },
    // A spread at module level is handed nowhere.
    { ...tsx('export const o = { ...(ok ? { r: () => <V /> } : {}) };'), errors: helper('r') },
    // `&&` is followed only into a spread: an object after `&&` handed over as is is not.
    { ...component('return <W o={ok && { r: () => <V /> }} />;'), errors: helper('r') },
    // An object on the left of `&&` is not what the spread takes.
    { ...component('return <W o={{ ...({ r: () => <V /> } && x) }} />;'), errors: helper('r') },
    // Spread into an array, not into the object handed over.
    { ...component('return <W r={[...(ok ? { r: () => <V /> } : {})]} />;'), errors: helper('r') },
    // An object thrown, not returned, is not handed over.
    {
      ...component('return <V onError={() => {\n  throw { render: () => <W /> };\n}} />;'),
      errors: helper('render'),
    },
    // A hook's block body returning the object is not handed over.
    {
      ...component(
        'const m = useMemo(() => {\n  return { x: () => <V /> };\n}, []);\nreturn <W m={m} />;',
      ),
      errors: helper('x'),
    },
    // A computed key is not a property value: the arrow is not handed over.
    { ...component('return <V o={{ [() => <W />]: 1 }} />;'), errors: helper('(anonymous)') },
  ],
});
