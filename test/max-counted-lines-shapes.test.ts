import rule from '../src/rules/max-counted-lines.ts';
import { ruleTester, tsx } from './setup.ts';

// Shapes that moved lines from one budget to another or out of every budget: a class static
// block, the conditions in a component's final return, JSX comments, and the member forms of an
// exempt callee (`describe.each(rows)(...)`, `describe.skip(...)`) next to `x.describe(...)`.
const SIX = '  a();\n  b();\n  c();\n  d();\n  e();\n  f();';
const EXEMPT: [{ function: number; exemptCallbacksOf: string[] }] = [
  { function: 5, exemptCallbacksOf: ['describe'] },
];
const fn = (n: number, name: string) => [
  { messageId: 'function' as const, data: { n, max: 5, name } },
];

ruleTester.run('max-counted-lines (shapes)', rule, {
  valid: [
    `class C {\n  static {\n  a();\n  b();\n  c();\n  d();\n  e();\n  }\n}`,
    ...[
      `describe.each([[1]])('x %s', () => {\n${SIX}\n});`,
      `describe.skip('x', () => {\n${SIX}\n});`,
      `describe.concurrent.each([[1]])('x %s', () => {\n${SIX}\n});`,
      `describe.for([[1]])('x %s', () => {\n${SIX}\n});`,
      `describe.each\`\n  a | b\n  \${1} | \${2}\n\`('rows $a', ({ a }) => {\n${SIX}\n});`,
    ].map((code) => ({ code, options: EXEMPT })),
    {
      // Four JSX lines (`return (`, `<V>`, `<W />`, `<X />`); the comment line is not one.
      ...tsx(
        'function Row() {\n  return (\n    <V>\n      {/* why this layout */}\n      <W />\n      <X />\n    </V>\n  );\n}',
      ),
      options: [{ componentJsx: 4 }],
    },
  ],
  invalid: [
    { code: `class C {\n  static {\n${SIX}\n  }\n}`, errors: fn(6, '(static block)') },
    ...[
      `x.describe('x', () => {\n${SIX}\n});`,
      `describe.each([[1]])('x %s', (n) => {\n  const f = () => {\n${SIX}\n  };\n});`,
    ].map((code) => ({
      code,
      options: EXEMPT,
      errors: fn(6, code.startsWith('x.') ? '(anonymous function)' : 'f'),
    })),
    {
      // The two conditions are logic: with them the component has 6 lines of logic, not 4.
      ...tsx(
        'function Row({ a }: P) {\n  const b = f(a);\n  const c = g(b);\n  const d = h(c);\n  const e = k(d);\n  return (\n    check(a, b, c) &&\n    verify(d, e) &&\n    <V />\n  );\n}',
      ),
      errors: [{ messageId: 'componentLogic', data: { n: 6, max: 5, name: 'Row' } }],
    },
    {
      // A ternary's test and a branch that is not JSX are logic too.
      ...tsx(
        'function Row({ a }: P) {\n  const b = f(a);\n  const c = g(b);\n  const d = h(c);\n  const e = k(d);\n  return isReady(a, b)\n    ? <V />\n    : fallback(c, d, e);\n}',
      ),
      errors: [{ messageId: 'componentLogic', data: { n: 6, max: 5, name: 'Row' } }],
    },
    {
      // A JSX comment never counts, in the file either.
      ...tsx('const x = (\n  <V>\n    {/* a */}\n    {/* b */}\n  </V>\n);'),
      options: [{ file: 1 }],
      errors: [{ messageId: 'file', data: { n: 2, max: 1 } }],
    },
  ],
});

// The edges of the return's logic: a branch that says nothing is not logic, a TS-only wrapper is
// looked through, a JSX return that is not last leaves all the body as logic, and a condition on
// a line of its own leaves the JSX budget.
const FOUR = '  const b = f(a);\n  const c = g(b);\n  const d = h(c);\n  const e = k(d);\n';
const row = (body: string) => tsx(`function Row({ a }: P) {\n${FOUR}${body}\n}`);
const logic = (n: number) => [
  { messageId: 'componentLogic' as const, data: { n, max: 5, name: 'Row' } },
];

ruleTester.run('max-counted-lines (return logic)', rule, {
  valid: [
    row('  return isReady(a)\n    ? <V />\n    : null;'),
    row('  return isReady(a)\n    ? <V />\n    : undefined;'),
    {
      ...tsx('function Row({ a }: P) {\n  return (\n    check(a)\n    && <V />\n  );\n}'),
      options: [{ componentJsx: 2 }],
    },
  ],
  invalid: [
    {
      ...row('  return (isReady(a)\n    ? <V />\n    : fallback(b)) as ReactElement;'),
      errors: logic(6),
    },
    { ...row('  return isReady(a)\n    ? <V />\n    : fallback;'), errors: logic(6) },
    {
      ...tsx(`function Row({ a }: P) {\n  if (a) return <V />;\n${FOUR}  return null;\n}`),
      errors: logic(6),
    },
  ],
});

// Every condition inside the final return is logic: in JSX children and attribute values too,
// but not inside a nested function, whose body is its own.
ruleTester.run('max-counted-lines (nested return logic)', rule, {
  valid: [
    // Conditions in the JSX of a nested arrow or function expression are that function's own.
    row(
      '  return (\n    <List\n      renderItem={() => <V>{a\n        && b\n        && <W />}</V>}\n    />\n  );',
    ),
    row(
      '  return (\n    <List\n      renderItem={function () {\n        return <V>{a\n          && b\n          && <W />}</V>;\n      }}\n    />\n  );',
    ),
    row(
      '  return (\n    <V\n      onPress={() =>\n        a && b(c)}\n      onLong={() =>\n        d || e()}\n    />\n  );',
    ),
  ],
  invalid: [
    {
      ...row(
        '  return (\n    <View>\n      {m.e &&\n        <A />}\n      {m.f\n        ? <B />\n        : <C />}\n    </View>\n  );',
      ),
      errors: logic(6),
    },
    {
      ...row('  return (\n    <View\n      label={ok(a)\n        ? x\n        : y}\n    />\n  );'),
      errors: logic(7),
    },
  ],
});

// Round 2: a condition anywhere inside a `{...}` is logic (an array, a call argument, an object, a
// spread), and a nested function's body is never logic, even inside a non-JSX branch.
ruleTester.run('max-counted-lines (conditions anywhere)', rule, {
  valid: [
    tsx(
      'export function List({ vm }: Props) {\n  return (\n    <View>\n      {vm.rows.length === 0 ? (\n        <Empty />\n      ) : (\n        vm.rows.map((r) => (\n          <Row\n            key={r.id}\n            row={r}\n            onPress={vm.onPress}\n          />\n        ))\n      )}\n    </View>\n  );\n}',
    ),
  ],
  invalid: [
    {
      ...row(
        '  return (\n    <View\n      style={[s.a,\n        m.e && s.b,\n        m.f && s.c]}\n    />\n  );',
      ),
      errors: logic(6),
    },
    {
      ...row(
        "  return (\n    <View>\n      <Text>{t(m.e ? 'a' : 'b')}</Text>\n      <Text>{t(m.f ? 'c' : 'd')}</Text>\n    </View>\n  );",
      ),
      errors: logic(6),
    },
    {
      ...row(
        '  return (\n    <View\n      {...(m.e ? p : q)}\n      state={{ disabled: m.f || m.g }}\n    />\n  );',
      ),
      errors: logic(6),
    },
  ],
});

// JSX stays JSX on the left of `||` and in an array branch of `?:`: only the condition is logic.
ruleTester.run('max-counted-lines (JSX operands)', rule, {
  valid: [
    // An array that holds any JSX stays JSX, a value beside it included.
    row(
      '  return (\n    <View>\n      {m.e\n        ? [\n            <A key="a" />,\n            m.extra,\n          ]\n        : null}\n    </View>\n  );',
    ),
    row(
      '  return (\n    <View>\n      {(m.e && (\n        <Banner\n          title={m.t}\n          onClose={m.c}\n        />\n      )) || <Empty />}\n    </View>\n  );',
    ),
    row(
      '  return (\n    <View>\n      {m.e\n        ? [\n            <A key="a" />,\n            <B key="b" />,\n            <C key="c" />,\n          ]\n        : null}\n    </View>\n  );',
    ),
  ],
  invalid: [],
});
