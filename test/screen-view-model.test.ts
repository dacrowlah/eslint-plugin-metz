import rule from '../src/rules/screen-view-model.ts';
import { ruleTester, tsx } from './setup.ts';

ruleTester.run('screen-view-model', rule, {
  valid: [
    tsx(
      'export function RaceScreen() { const vm = useRaceViewModel(); type Bd = typeof vm.board; return <Board board={vm.board} />; }',
    ),
    tsx(
      'export function RaceScreen() { const vm = useRaceViewModel(); type VM = typeof vm; return <Board board={vm.board} />; }',
    ),
    tsx(
      'export function RaceScreen() { const vm = useRaceViewModel(); return <RaceView vm={vm} />; }',
    ),
    tsx(
      'export function RaceScreen() { const vm = useRaceViewModel(); return <Board board={vm.board} onRoll={vm.roll} />; }',
    ),
    tsx(
      'export function RaceScreen() { const vm = useRaceViewModel(); return <Button onPress={() => vm.roll()} />; }',
    ),
    tsx(
      'export function RaceScreen() { const { board, roll } = useRaceViewModel(); return <Board board={board} onRoll={roll} />; }',
    ),
    tsx(
      'export default function RaceScreen() { const vm = useRaceViewModel(); return <Board board={vm.board} />; }',
    ),
  ],
  invalid: [
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); return <Board board={format(vm)} />; }',
      ),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); const alias = vm; return <Board cells={alias.board.cells} />; }',
      ),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); const { board } = vm; return <Board cells={board.cells} />; }',
      ),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); const { board: { cells } } = vm; return <Board cells={cells} />; }',
      ),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); const all = { ...vm }; return <Board all={all} />; }',
      ),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); const v = use(Ctx); return <V a={vm.a} v={v} />; }',
      ),
      errors: [{ messageId: 'exactlyOne', data: { name: 'RaceScreen', n: 2 } }],
    },
    {
      ...tsx(
        'import { useQuery as query } from "q";\nexport function RaceScreen() { const vm = useRaceViewModel(); const q = query(); return <V a={vm.a} q={q} />; }',
      ),
      errors: [{ messageId: 'exactlyOne', data: { name: 'RaceScreen', n: 2 } }],
    },
    {
      ...tsx(
        'import { useRaceStore as read } from "s";\nexport function RaceScreen() { const s = read(); return <V s={s} />; }',
      ),
      errors: [{ messageId: 'notViewModel' }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); const [x] = useState(0); return <V />; }',
      ),
      errors: [{ messageId: 'exactlyOne', data: { name: 'RaceScreen', n: 2 } }],
    },
    {
      ...tsx('export function RaceScreen() { return <V />; }'),
      errors: [{ messageId: 'exactlyOne', data: { name: 'RaceScreen', n: 0 } }],
    },
    {
      ...tsx('export function RaceScreen() { const s = useRaceStore(); return <V s={s} />; }'),
      errors: [{ messageId: 'notViewModel' }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); return <Board cells={vm.board.cells} />; }',
      ),
      errors: [{ messageId: 'reachThrough', data: { text: 'vm.board.cells' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const { board } = useRaceViewModel(); return <Board cells={board.cells} />; }',
      ),
      errors: [{ messageId: 'reachThrough', data: { text: 'board.cells' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const { board: { cells } } = useRaceViewModel(); return <Board cells={cells} />; }',
      ),
      errors: [{ messageId: 'binding' }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); return <Board {...vm} />; }',
      ),
      errors: [{ messageId: 'spread' }],
    },
  ],
});
