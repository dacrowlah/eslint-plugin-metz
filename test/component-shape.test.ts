import rule from '../src/rules/component-shape.ts';
import { ruleTester, tsx } from './setup.ts';

ruleTester.run('component-shape', rule, {
  valid: [
    tsx('export function A() { return <V>{render(<X />).container}</V>; }'),
    tsx("it('renders', async () => { await render(<TurnPanel canAct={false} />); });"),
    tsx('function setup() { return render(<TurnPanel canAct />); }'),
    tsx(
      'export function A() { const onPress = () => showSheet(<Sheet />); return <V onPress={onPress} />; }',
    ),
    tsx(
      "export function A() { const items = useMemo(() => [{ key: 'a', icon: <Icon /> }], []); return <V items={items} />; }",
    ),
    tsx('export const Foo = memo(forwardRef((p, ref) => <View ref={ref} />));'),
    tsx('export const Foo = (() => <View />) satisfies FC;'),
    tsx(
      'export function Board({ board }: BoardProps) { return <View>{board.rows.map((r) => <Row key={r.id} row={r} />)}</View>; }',
    ),
    tsx('export const Board = memo(function Board() { return <View />; });'),
    tsx(
      'export function List() { return <FlatList renderItem={({ item }) => <Row row={item} />} />; }',
    ),
    tsx('export function toLabel(x: number) { return `#${x}`; }'),
    tsx('export function A() { return <V><W><X><Y /></X></W></V>; }'), // depth 3
  ],
  invalid: [
    {
      ...tsx('export const rows = () => [<Row key="a" />, <Row key="b" />].filter(Boolean);'),
      errors: [{ messageId: 'renderHelper', data: { name: 'rows' } }],
    },
    {
      ...tsx('export const first = () => { return [<V />][0]; };'),
      errors: [{ messageId: 'renderHelper', data: { name: 'first' } }],
    },
    {
      ...tsx('export function pick() { const { el } = { el: <V /> }; return el; }'),
      errors: [{ messageId: 'renderHelper', data: { name: 'pick' } }],
    },
    {
      ...tsx(
        'import { useCallback as cb } from "react";\nexport function A() { const f = cb(() => <Row />, []); return <V>{f()}</V>; }',
      ),
      errors: [{ messageId: 'renderHelper' }],
    },
    {
      ...tsx('export function A() { const f = useMemo(() => <X />, []); return <V>{f}</V>; }'),
      errors: [{ messageId: 'renderHelper' }],
    },
    {
      ...tsx(
        'export function renderRows(xs) { const rows = xs.map((x) => <Row key={x} />); return rows; }',
      ),
      errors: [{ messageId: 'renderHelper', data: { name: 'renderRows' } }],
    },
    {
      ...tsx('export function pick(a) { const el = a ? <A /> : null; return el as ReactElement; }'),
      errors: [{ messageId: 'renderHelper', data: { name: 'pick' } }],
    },
    {
      ...tsx('export const A = memo(() => <View />);\nexport const B = memo(() => <Text />);'),
      errors: [{ messageId: 'onePerFile', data: { name: 'B' } }],
    },
    {
      ...tsx('export function A() { const B = memo(() => <T />); return <B />; }'),
      errors: [{ messageId: 'nestedComponent', data: { name: 'B' } }],
    },
    {
      ...tsx('export function renderRow() { const el = <Row />; return el; }'),
      errors: [{ messageId: 'renderHelper', data: { name: 'renderRow' } }],
    },
    {
      ...tsx(
        'export function A() { return <V />; }\nexport function B() { const el = <V />; return el; }',
      ),
      errors: [{ messageId: 'onePerFile', data: { name: 'B' } }],
    },
    {
      ...tsx('export const renderRows = () => [<Row key="a" />, <Row key="b" />];'),
      errors: [{ messageId: 'renderHelper', data: { name: 'renderRows' } }],
    },
    {
      ...tsx('export const toEl = () => (<Row />) as ReactElement;'),
      errors: [{ messageId: 'renderHelper', data: { name: 'toEl' } }],
    },
    {
      ...tsx(
        'export function A() { const cb = useCallback(() => <Row />, []); return <V>{cb()}</V>; }',
      ),
      errors: [{ messageId: 'renderHelper' }],
    },
    {
      ...tsx(
        'export function Board() { const renderRow = () => <Row />; return <View>{renderRow()}</View>; }',
      ),
      errors: [{ messageId: 'renderHelper', data: { name: 'renderRow' } }],
    },
    {
      ...tsx('export function Board() { function Row() { return <Text />; } return <Row />; }'),
      errors: [{ messageId: 'nestedComponent', data: { name: 'Row' } }],
    },
    {
      ...tsx('export function A() { return <V />; }\nexport function B() { return <V />; }'),
      errors: [{ messageId: 'onePerFile', data: { name: 'B' } }],
    },
    {
      ...tsx('export function renderHeader() { return <V />; }'),
      errors: [{ messageId: 'renderHelper', data: { name: 'renderHeader' } }],
    },
    { ...tsx('export default () => <V />;'), errors: [{ messageId: 'anonymous' }] },
    {
      ...tsx('export function A() { return <V><W><X><Y><Z /></Y></X></W></V>; }'),
      errors: [{ messageId: 'jsxDepth', data: { depth: 4, max: 3 } }],
    },
    {
      ...tsx(
        'export function A() { return <V><W><X>{xs.map((x) => <Y key={x}><Z /></Y>)}</X></W></V>; }',
      ),
      errors: [{ messageId: 'jsxDepth', data: { depth: 4, max: 3 } }],
    },
  ],
});
