import rule from '../src/rules/max-counted-lines.ts';
import { ruleTester, tsx } from './setup.ts';

const fiveLineIfElse = `
function pick(a: boolean) {
  // comments never count

  if (a) {
    return one({
      x: 1,
    });
  } else {
    return two();
  }
}`; // if / return one({ / x: 1, / } else { / return two(); => 5 CL

ruleTester.run('max-counted-lines', rule, {
  valid: [
    tsx(`
export const Foo = memo(
  forwardRef((p, ref) => {
    const a = 1;
  const b = 2;
  const c = 3;
  return (
    <View>
      <Text>{a + b + c}</Text>
    </View>
  );
  }),
);`),
    tsx(`
export const Foo = ((p) => {
    const a = 1;
  const b = 2;
  const c = 3;
  return (
    <View>
      <Text>{a + b + c}</Text>
    </View>
  );
}) satisfies FC;`),
    fiveLineIfElse,
    'const double = (x: number) => x * 2;',
    tsx(`
import { View } from 'react-native';
import { Board } from './Board';

export function RaceScreen() {
  const vm = useRaceViewModel();
  return (
    <View>
      <Board board={vm.board} />
      <Controls
        controls={vm.controls}
        onRoll={vm.roll}
      />
    </View>
  );
}`),
    {
      code: 'describe("x", () => { a(); b(); c(); d(); e(); f(); });',
      options: [{ function: 5, exemptCallbacksOf: ['describe'] }],
    },
  ],
  invalid: [
    {
      code: 'x.describe("x", () => {\n  a();\n  b();\n  c();\n  d();\n  e();\n  f();\n});',
      options: [{ function: 5, exemptCallbacksOf: ['describe'] }],
      errors: [{ messageId: 'function' }],
    },
    {
      code: `function six() {\n  a();\n  b();\n  c();\n  d();\n  e();\n  f();\n}`,
      errors: [{ messageId: 'function', data: { n: 6, max: 5, name: 'six' } }],
    },
    {
      code: 'const x = 1;\nconst y = 2;\nconst z = 3;',
      options: [{ file: 2 }],
      errors: [{ messageId: 'file', data: { n: 3, max: 2, name: '' } }],
    },
    {
      code: 'import a from "a";\nimport b from "b";\nconst x = a;\nconst y = b;\nconst z = 3;',
      options: [{ file: 2 }],
      errors: [{ messageId: 'file', data: { n: 3, max: 2, name: '' } }],
    },
    {
      ...tsx(`
function Row() {
  const a = 1;
  const b = 2;
  return (
    <View>
      <Text>{a}</Text>
      <Text>{b}</Text>
    </View>
  );
}`),
      options: [{ componentLogic: 1, componentJsx: 3 }],
      errors: [
        { messageId: 'componentLogic', data: { n: 2, max: 1, name: 'Row' } },
        { messageId: 'componentJsx', data: { n: 4, max: 3, name: 'Row' } },
      ],
    },
  ],
});
