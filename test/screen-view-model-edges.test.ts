import rule from '../src/rules/screen-view-model.ts';
import { ruleTester, tsx } from './setup.ts';

// Edges the main table leaves open: names that only contain `use`, non-screen functions, nested
// destructuring, and the view model used as a computed key or a JSX child.
const SCREEN = (body: string) =>
  `export function RaceScreen() { const vm = useRaceViewModel(); ${body} }`;

ruleTester.run('screen-view-model (edges)', rule, {
  valid: [
    tsx(SCREEN('const t = reuseTimer(); return <V t={t} a={vm.a} />;')),
    tsx(SCREEN('return <V a={other[vm.a]} />;')),
    tsx(
      `import { useThing as thing } from 'x';\n${SCREEN('const t = obj.thing(); return <V t={t} a={vm.a} />;')}`,
    ),
    tsx('export function useThing() { const a = useA(); const b = useB(); return a + b; }'),
  ],
  invalid: [
    // An anonymous screen goes by its file's name, from a Windows path too.
    {
      code: 'export default function () { const vm = useRaceViewModel(); return <Board vm={vm} />; }',
      filename: 'C:\\app\\screens\\RaceScreen.tsx',
      errors: [{ messageId: 'wholeViewModel', data: { name: 'Board', view: 'RaceView' } }],
    },
    {
      code: 'export default function () { const vm = useRaceViewModel(); return <Board vm={vm} />; }',
      filename: 'C:\\app/screens\\RaceScreen.tsx',
      errors: [{ messageId: 'wholeViewModel', data: { name: 'Board', view: 'RaceView' } }],
    },
    {
      code: 'export default function () { const vm = useRaceViewModel(); return <Board vm={vm} />; }',
      filename: '/app\\x/screens/RaceScreen.tsx',
      errors: [{ messageId: 'wholeViewModel', data: { name: 'Board', view: 'RaceView' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const { a, b: { c } } = useRaceViewModel(); return <V a={a} c={c} />; }',
      ),
      errors: [{ messageId: 'binding' }],
    },
    {
      ...tsx(SCREEN('return <V a={other[vm]} />;')),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm' } }],
    },
    {
      ...tsx(SCREEN('return <V>{vm}</V>;')),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm' } }],
    },
  ],
});
