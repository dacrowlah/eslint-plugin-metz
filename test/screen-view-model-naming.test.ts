import rule from '../src/rules/screen-view-model.ts';
import { ruleTester, tsx } from './setup.ts';

// The naming options: which component may take the whole view model is the screen's name without
// screenSuffix, plus viewSuffix.
const PAGE = (body: string) =>
  `export function RacePage() { const vm = useRacePageModel(); ${body} }`;
const NAMING = { viewModelPattern: '^use\\w+Model$', screenSuffix: 'Page', viewSuffix: 'Body' };

ruleTester.run('screen-view-model naming', rule, {
  valid: [
    { ...tsx(PAGE('return <RaceBody vm={vm} />;')), options: [NAMING] },
    {
      ...tsx('export function Race() { const vm = useRaceModel(); return <RaceBody vm={vm} />; }'),
      options: [NAMING],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); return <RaceScreenPanel vm={vm} />; }',
      ),
      options: [{ screenSuffix: 'Page', viewSuffix: 'Panel' }],
    },
  ],
  invalid: [
    {
      ...tsx(PAGE('return <RaceView vm={vm} />;')),
      options: [NAMING],
      errors: [{ messageId: 'wholeViewModel', data: { name: 'RaceView', view: 'RaceBody' } }],
    },
    {
      ...tsx(PAGE('return <RacePageBody vm={vm} />;')),
      options: [NAMING],
      errors: [{ messageId: 'wholeViewModel', data: { name: 'RacePageBody', view: 'RaceBody' } }],
    },
    {
      ...tsx(
        'export function RaceScreen() { const vm = useRaceViewModel(); return <RaceView vm={vm} />; }',
      ),
      options: [{ screenSuffix: 'Page' }],
      errors: [{ messageId: 'wholeViewModel', data: { name: 'RaceView', view: 'RaceScreenView' } }],
    },
  ],
});
