import rule from '../src/rules/screen-view-model.ts';
import { ruleTester, tsx } from './setup.ts';

// Reach-through hidden behind TS-only syntax or a call, an anonymous default-exported screen,
// hooks called under another name, and the whole view model passed to a child (M9: one slice,
// except to the screen's own view).
const SCREEN = (body: string) =>
  `export function RaceScreen() { const vm = useRaceViewModel(); ${body} }`;
const reach = (text: string) => [{ messageId: 'reachThrough' as const, data: { text } }];

ruleTester.run('screen-view-model (reach)', rule, {
  valid: [
    tsx(SCREEN('type Cells = typeof vm.board.cells; return <V a={vm.board} />;')),
    tsx(SCREEN('return <RaceView vm={vm} />;')),
    tsx('export function Race() { const vm = useRaceViewModel(); return <RaceView vm={vm} />; }'),
    tsx(SCREEN('return <V a={vm.board!} b={vm.board as Board} c={vm.roll()} />;')),
    tsx(SCREEN('return <V a={format(vm.board).label} />;')),
    tsx(
      'export function ScreenTimeScreen() { const vm = useScreenTimeViewModel(); return <ScreenTimeView vm={vm} />; }',
    ),
    tsx('export default function helper() { useA(); useB(); return 1; }'),
    tsx(SCREEN('const board = vm.board; return <Grid board={board} />;')),
    tsx(SCREEN('return <Grid board={vm.board ?? EMPTY} />;')),
    // A slice used as a test is not handed on.
    tsx(SCREEN('const b = vm.ok ? one : two; return <Grid cells={b.cells} />;')),
    // A slice on the right of a comparison is read, not looped over.
    tsx(SCREEN('const same = other === vm.board; return <Grid same={same} />;')),
    // A slice local reassigned by a loop is not a loop over the slice.
    tsx(SCREEN('let b = vm.board; for (b of others) log(b); return <Grid board={vm.board} />;')),
    // A redeclared var cannot loop the walk.
    tsx(SCREEN('var b = vm.board; var b = b; return <Grid board={b} />;')),
    {
      code: 'export default function () { const vm = useRaceViewModel(); return <RaceView vm={vm} />; }',
      filename: 'src/screens/RaceScreen.tsx',
    },
    // Not hooks: an alias cycle ends the walk, a variable with no initialiser, a computed member.
    tsx(
      SCREEN(
        "const a = b; const b = a; a(); let q: Q; q(); const s = React['useState']; s(); return <V a={vm.a} />;",
      ),
    ),
  ],
  invalid: [
    { ...tsx(SCREEN('return <V a={vm.board!.cells} />;')), errors: reach('vm.board!.cells') },
    {
      ...tsx(SCREEN('return <V a={(vm.board as Board).cells} />;')),
      errors: reach('(vm.board as Board).cells'),
    },
    {
      ...tsx(SCREEN('return <V a={(vm.board satisfies Board).cells} />;')),
      errors: reach('(vm.board satisfies Board).cells'),
    },
    {
      ...tsx(
        'export function RaceScreen() { const { board } = useRaceViewModel(); return <V a={board!.cells} />; }',
      ),
      errors: reach('board!.cells'),
    },
    {
      ...tsx(SCREEN('return <V a={vm.getBoard().cells} />;')),
      errors: reach('vm.getBoard().cells'),
    },
    {
      ...tsx(
        'export default function () { const vm = useRaceViewModel(); return <V a={vm.board.cells} />; }',
      ),
      errors: reach('vm.board.cells'),
    },
    {
      ...tsx(
        'export default () => { const vm = useRaceViewModel(); return <V a={vm.board.cells} />; };',
      ),
      errors: reach('vm.board.cells'),
    },
    {
      code: SCREEN('return (<Board>vm.board).cells;'),
      filename: 'file.ts',
      errors: reach('(<Board>vm.board).cells'),
    },
    {
      ...tsx(SCREEN('return <UI.RaceView vm={vm} />;')),
      errors: [{ messageId: 'wholeViewModel', data: { view: 'RaceView', name: 'UI.RaceView' } }],
    },
    // An anonymous screen goes by its file's name.
    {
      code: 'export default function () { useA(); const vm = useRaceViewModel(); return <V a={vm.a} />; }',
      filename: 'src/screens/RaceScreen.tsx',
      errors: [{ messageId: 'exactlyOne', data: { name: 'RaceScreen', n: 2 } }],
    },
    {
      code: 'export default function () { const vm = useRaceViewModel(); return <Board vm={vm} />; }',
      filename: 'src/screens/RaceScreen.tsx',
      errors: [{ messageId: 'wholeViewModel', data: { view: 'RaceView', name: 'Board' } }],
    },
    // Through a fallback, a choice or a loop, once per read.
    {
      ...tsx(SCREEN('const b = vm.board ?? EMPTY; return <Grid cells={b.cells} />;')),
      errors: reach('b.cells'),
    },
    {
      ...tsx(SCREEN('const b = ok ? vm.a : vm.b; return <Grid cells={b.cells} />;')),
      errors: reach('b.cells'),
    },
    {
      ...tsx(SCREEN('const { cells } = vm.board ?? {}; return <Grid cells={cells} />;')),
      errors: reach('{ cells }'),
    },
    {
      ...tsx(SCREEN('for (const r of vm.rows) log(r.id); return <Grid rows={vm.rows} />;')),
      errors: reach('const r'),
    },
    {
      ...tsx(SCREEN('for (const k in vm.board) log(k); return <Grid />;')),
      errors: reach('const k'),
    },
    // A slice bound to a local is still the view model's: nothing may be read off it.
    {
      ...tsx(SCREEN('const board = vm.board; return <Grid cells={board.cells} />;')),
      errors: reach('board.cells'),
    },
    {
      ...tsx(SCREEN('const { cells } = vm.board; return <Grid cells={cells} />;')),
      errors: reach('{ cells }'),
    },
    {
      ...tsx(
        SCREEN('const board = vm.getBoard(); const b = board; return <Grid cells={b.cells} />;'),
      ),
      errors: reach('b.cells'),
    },
    // A hook under another name: a default import named for its module (with an extension), a
    // default import named like a hook, a variable holding a member hook, a destructured hook.
    ...[
      ["import query from './hooks/useQuery.ts';\n", 'query();'],
      ["import useThing from './thing';\n", 'useThing();'],
      ['', 'const s = React.useState; s();'],
      ['', 'const { useQuery } = hooks; useQuery();'],
    ].map(([imports, call]) => ({
      ...tsx(`${imports ?? ''}${SCREEN(`${call ?? ''} return <V a={vm.a} />;`)}`),
      errors: [{ messageId: 'exactlyOne' as const, data: { name: 'RaceScreen', n: 2 } }],
    })),
    {
      ...tsx(SCREEN('return <Board vm={vm} />;')),
      errors: [{ messageId: 'wholeViewModel', data: { view: 'RaceView', name: 'Board' } }],
    },
    {
      ...tsx(SCREEN('const q = useQuery; q(); return <V a={vm.a} />;')),
      errors: [{ messageId: 'exactlyOne', data: { name: 'RaceScreen', n: 2 } }],
    },
    {
      ...tsx(`import query from './useQuery';\n${SCREEN('query(); return <V a={vm.a} />;')}`),
      errors: [{ messageId: 'exactlyOne', data: { name: 'RaceScreen', n: 2 } }],
    },
  ],
});
