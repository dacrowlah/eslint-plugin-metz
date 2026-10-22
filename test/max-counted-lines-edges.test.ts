import rule from '../src/rules/max-counted-lines.ts';
import { ruleTester, tsx } from './setup.ts';

// Edges the main table leaves open: exempt callbacks that really are long, concise bodies,
// anonymous and non-component PascalCase functions, and the shapes a component may return.
const SIX = '  a();\n  b();\n  c();\n  d();\n  e();\n  f();';

ruleTester.run('max-counted-lines (edges)', rule, {
  valid: [
    {
      code: `describe('x', () => {\n${SIX}\n});`,
      options: [{ function: 5, exemptCallbacksOf: ['describe'] }],
    },
    'const curry = (a: number) => (b: number) => a + b;',
  ],
  invalid: [
    {
      code: `const o = { long() {\n${SIX}\n} };`,
      errors: [{ messageId: 'function', data: { n: 6, max: 5, name: 'long' } }],
    },
    {
      code: `class C { long() {\n${SIX}\n} }`,
      errors: [{ messageId: 'function', data: { n: 6, max: 5, name: 'long' } }],
    },
    {
      code: `class C { long = () => {\n${SIX}\n}; }`,
      errors: [{ messageId: 'function', data: { n: 6, max: 5, name: 'long' } }],
    },
    {
      code: `function Build() {\n${SIX}\n  return;\n}`,
      errors: [{ messageId: 'function', data: { n: 7, max: 5, name: 'Build' } }],
    },
    {
      code: `function Pick(a: boolean) {\n${SIX}\n  return a ? 1 : 2;\n}`,
      errors: [{ messageId: 'function', data: { n: 7, max: 5, name: 'Pick' } }],
    },
    {
      code: 'const f = (a: number) =>\n  a\n  + 1;',
      options: [{ function: 1 }],
      errors: [{ messageId: 'function', data: { n: 2, max: 1, name: 'f' } }],
    },
    {
      code: 'const Area = (a: number) =>\n  a\n  * 2;',
      options: [{ function: 1 }],
      errors: [{ messageId: 'function', data: { n: 2, max: 1, name: 'Area' } }],
    },
    {
      code: `export default function () {\n${SIX}\n}`,
      errors: [{ messageId: 'function', data: { n: 6, max: 5, name: '(anonymous function)' } }],
    },
    {
      code: `function Build() {\n${SIX}\n}`,
      errors: [{ messageId: 'function', data: { n: 6, max: 5, name: 'Build' } }],
    },
    {
      code: 'const helper = <F>((a: number) => {\n  a++;\n  return a;\n});',
      filename: 'file.ts',
      options: [{ function: 1 }],
      errors: [{ messageId: 'function', data: { n: 2, max: 1, name: 'helper' } }],
    },
    {
      code: 'const A = memo(Base, (a: P, b: P) => {\n  x();\n  return a === b;\n});',
      options: [{ function: 1 }],
      errors: [{ messageId: 'function', data: { n: 2, max: 1, name: '(anonymous function)' } }],
    },
    {
      ...tsx('const Row = () => (\n  <View>\n    <Text />\n  </View>\n);'),
      options: [{ componentJsx: 1 }],
      errors: [{ messageId: 'componentJsx', data: { n: 2, max: 1, name: 'Row' } }],
    },
    {
      ...tsx('function Row() {\n  return (\n    <>\n      <V />\n    </>\n  );\n}'),
      options: [{ componentJsx: 1 }],
      errors: [{ messageId: 'componentJsx', data: { n: 3, max: 1, name: 'Row' } }],
    },
    {
      ...tsx('function Row({ a }: P) {\n  return a\n    ? <V />\n    : null;\n}'),
      options: [{ componentJsx: 2 }],
      errors: [{ messageId: 'componentJsx', data: { n: 3, max: 2, name: 'Row' } }],
    },
    {
      ...tsx('function Row() {\n  return (\n    <V />\n  ) as ReactElement;\n}'),
      options: [{ componentJsx: 1 }],
      errors: [{ messageId: 'componentJsx', data: { n: 3, max: 1, name: 'Row' } }],
    },
    {
      // JSX text that is exactly a closer character still counts: line 5 holds `}` (a closer), the
      // JSXText `,` and the skipped `</p>`, so it is counted for the comma alone (4 lines, not 3).
      ...tsx('function para(a: number) {\n  return (\n    <p>\n      {a\n      },</p>\n  );\n}'),
      options: [{ function: 3 }],
      errors: [{ messageId: 'function', data: { n: 4, max: 3, name: 'para' } }],
    },
  ],
});
