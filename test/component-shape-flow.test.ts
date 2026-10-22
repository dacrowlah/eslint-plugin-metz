import rule from '../src/rules/component-shape.ts';
import { ruleTester, tsx } from './setup.ts';

// How JSX flows out of a function (src/jsx-flow.ts): the array builders, what a method hands
// back, a property read off an object that a variable held, and destructuring by a computed key.
const fn = (body: string) => tsx(`export function f(xs: X[], k: K) { ${body} }`);
const helper = [{ messageId: 'renderHelper' as const, data: { name: 'f' } }];
/** Methods that hand back no element of the array they are called on. */
const NO_ELEMENT = [
  ...['indexOf', 'lastIndexOf', 'findIndex', 'findLastIndex', 'includes', 'some', 'every'],
  ...['join', 'toString', 'toLocaleString', 'forEach', 'keys', 'push', 'unshift'],
];

ruleTester.run('component-shape (flow)', rule, {
  valid: [
    ...NO_ELEMENT.map((method) => fn(`return [<V key="v" />].${method}(k);`)),
    fn('return xs.map(String);'),
    fn('return Foo.of(<V />);'),
    fn('const { a: el } = { a: 1, b: <V /> };\n  return el;'),
    fn('const counts = { a: 1, b: 2 };\n  return counts[k];'),
    fn('const out = [];\n  out.push(1);\n  return out;'),
    // A filler named but not called on the array, and a name read off an object holding JSX.
    fn('const out = [];\n  keep(out.push, <V />);\n  return out;'),
    fn('const t = { a: 1 } as const;\n  return t[k];'),
    // An index read of another array is not a write to it; a computed `push` is not a filler.
    fn('let i = 0;\n  const a = [];\n  a[i] = <V />;\n  return i;'),
    fn('const push = 0;\n  const out = [String];\n  out[push](<V />);\n  return out;'),
    fn('const parts = [];\n  parts.push(String(k));\n  router.push(k);\n  return parts;'),
    // Variables that alias each other (a swap, a cycle) end the walk instead of overflowing.
    fn(
      'let x = xs[0];\n  let y = xs[1];\n  if (k) {\n    const t = x;\n    x = y;\n    y = t;\n  }\n  return x.label;',
    ),
    fn('let a = {};\n  let b = a;\n  a = b;\n  return a.x;'),
    fn('const o = { a: 1, el: <V /> };\n  return o.a;'),
    // A property written by name is an object holding JSX; a read on the right writes nothing.
    fn('const o = { title: k };\n  o.headerTitle = <Logo />;\n  return o;'),
    fn('const o = { el: <V /> };\n  let x;\n  x = o.el;\n  return o;'),
    fn('const o = { el: <V /> };\n  let x;\n  x = o[k];\n  return o;'),
    // A write by a string key is a write by name.
    fn("const o = { title: k };\n  o['icon'] = <Logo />;\n  return o;"),
    fn('const o = { title: k };\n  o[`icon`] = <Logo />;\n  return o;'),
    // A logical assignment of no JSX hands back no JSX.
    fn('const c = { n: 1 };\n  return (c.n ??= 0);'),
  ],
  invalid: [
    { ...fn('return xs.flatMap((x) => <Row key={x} />);'), errors: helper },
    { ...fn('return Array.from(xs, (x) => <Row key={x} />);'), errors: helper },
    { ...fn('return Array.of(1, <V />);'), errors: helper },
    { ...fn('let o = { el: 1 };\n  o = { el: <V /> };\n  return o.el;'), errors: helper },
    { ...fn('const { [k]: el } = { a: <V /> };\n  return el;'), errors: helper },
    { ...fn('return [<V key="v" />].filter(Boolean);'), errors: helper },
    // A lookup table read by key, computed or literal, and an array filled by a method.
    { ...fn('const icons = { a: <A />, b: <B /> };\n  return icons[k];'), errors: helper },
    { ...fn("const icons = { a: <A />, b: <B /> };\n  return icons['a'];"), errors: helper },
    {
      ...tsx('const ICONS = { a: <A />, b: <B /> };\nexport function f(k: K) { return ICONS[k]; }'),
      errors: helper,
    },
    ...['push', 'unshift'].map((method) => ({
      ...fn(`const out = [];\n  for (const x of xs) out.${method}(<V key={x} />);\n  return out;`),
      errors: helper,
    })),
    { ...fn('const out = [1];\n  out.splice(0, 0, <V />);\n  return out;'), errors: helper },
    // A typed lookup table, nested tables, and arrays filled by index, `fill` or `concat`.
    { ...fn('const icons = { a: <A />, b: <B /> } as const;\n  return icons[k];'), errors: helper },
    {
      ...fn(
        'const icons = { a: <A />, b: <B /> } satisfies Record<K, ReactElement>;\n  return icons[k];',
      ),
      errors: helper,
    },
    { ...fn('const icons = { a: <A /> } as const;\n  return icons.a;'), errors: helper },
    { ...fn('const t = { big: { a: <A /> } };\n  return t[k][k];'), errors: helper },
    {
      ...fn('const out = [];\n  for (const x of xs) out[x.i] = <V />;\n  return out;'),
      errors: helper,
    },
    { ...fn('return Array(3).fill(<Star />);'), errors: helper },
    { ...fn('const out = [];\n  out[0] = <V />;\n  return out;'), errors: helper },
    // A template key with a substitution is computed: an index write.
    {
      ...fn('const out = [];\n  for (const x of xs) out[`${x.i}`] = <V />;\n  return out;'),
      errors: helper,
    },
    // A logical assignment hands back the left's old value or the right: a memo cache.
    ...['??=', '||=', '&&='].map((op) => ({
      ...tsx(
        `const cache = {};\nexport const iconFor = (k: K) => (cache[k] ${op} <Icon name={k} />);`,
      ),
      errors: [{ messageId: 'renderHelper' as const, data: { name: 'iconFor' } }],
    })),
    { ...fn('const out = [];\n  return out.concat(1, <V />);'), errors: helper },
    // A table reached through an optional chain.
    {
      ...fn('const all = { t: { a: <A /> } };\n  const t = all?.t;\n  return t[k];'),
      errors: helper,
    },
  ],
});
