import rule from '../src/rules/component-shape.ts';
import { ruleTester, tsx } from './setup.ts';

// Edges the main table leaves open: TS wrappers around a wrapped component, names that only
// start PascalCase, fragments in the depth count, and nested functions as depth boundaries.
const DEEP = (handler: string) =>
  `export function A() { return <V><W><X><L onPress={${handler}} /></X></W></V>; }`;

ruleTester.run('component-shape (edges)', rule, {
  valid: [
    tsx('export const A = memo(() => <V />) as FC;'),
    tsx('export const A = memo(() => <V />)!;'),
    tsx('function Row() { return <V />; }'),
    tsx('export function A() { return <V>{xs.map((x) => <><Row key={x} /></>)}</V>; }'),
    tsx('export function pick() { const { a } = { a: 1, b: <V /> }; return a; }'),
    tsx('export function pick() { return [, 1]; }'),
    tsx('export function pick() { let x = 1; x = x; return x; }'),
    tsx('export function pick(a) { return a ? 1 : 2; }'),
    tsx('export function pick(a, b) { return a || b; }'),
    tsx('export function pick() { const xs = [1]; return xs?.[0]; }'),
  ],
  invalid: [
    ...[
      'return <V /> satisfies El;',
      'return (<V />)!;',
      'return xs.map((x) => <Row key={x} />, ctx);',
      'return a || <V />;',
      'return [1, <V />];',
      'return (a(), b(), <V />);',
      'let el = null; el = <V />; return el;',
      'const els = [<V />]; return els?.[0];',
      'return xs?.map((x) => <Row key={x} />);',
      'const el = <V />; return el<string>;',
    ].map((body) => ({
      ...tsx(`export function pick(a, xs, ctx) { ${body} }`),
      errors: [{ messageId: 'renderHelper' as const, data: { name: 'pick' } }],
    })),
    {
      ...tsx('export function A() { return <V>{xs.map((x) => { return <Row key={x} />; })}</V>; }'),
      errors: [{ messageId: 'renderHelper', data: { name: '(anonymous)' } }],
    },
    {
      ...tsx('export function Row_item() { return <V />; }'),
      errors: [{ messageId: 'renderHelper', data: { name: 'Row_item' } }],
    },
    {
      ...tsx('export function A() { return <><W><X><Y><Z /></Y></X></W></>; }'),
      errors: [{ messageId: 'jsxDepth', data: { depth: 4, max: 3 } }],
    },
    {
      ...tsx(DEEP('function () { return <Y />; }')),
      errors: [{ messageId: 'renderHelper', data: { name: '(anonymous)' } }],
    },
    {
      ...tsx(DEEP('() => { return <Y />; }')),
      errors: [{ messageId: 'renderHelper', data: { name: '(anonymous)' } }],
    },
  ],
});
