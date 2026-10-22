// metz/screen-view-model — Sandi Metz rule 4 for React screens:
// "Controllers can instantiate only one object. Therefore, views can only know about one
//  instance variable and views should only send messages to that object."
//   - a screen component calls exactly ONE hook, and it must be its view-model hook;
//   - the view model is bound to one identifier, or destructured one level deep (no nesting, no rest);
//   - the screen may pass vm.slice (or a destructured slice) on, or call vm.command(), but never
//     reach through it, behind TS-only syntax or a call too: vm.board.cells, board.cells,
//     vm.racer.move(), vm.board!.cells, (vm.board as Board).cells and vm.getBoard().cells are
//     reported;
//   - the view model is never spread into JSX ({...vm}), and is passed whole only to the screen's
//     own view: `<RaceView vm={vm} />` in RaceScreen (any other child gets one slice).
// A default-exported anonymous function in a screen file is the screen, and is checked too.
// Apply this rule only to screen files, through `files` in the config (the React presets use
// SCREEN_FILES).
import { createRule } from '../create-rule.ts';
import { optionsSchema, resolveOptions, type RuleSpec } from '../options.ts';
import { type MessageIds, type ScreenSettings, screenListeners } from '../screen-checks.ts';

type Options = [Partial<ScreenSettings>];

/** The rule's name, options and defaults (pinned by test/rule-specs.test.ts). */
export const RULE = {
  name: 'screen-view-model',
  defaults: {
    viewModelPattern: '^use[A-Z]\\w*ViewModel$',
    screenSuffix: 'Screen',
    viewSuffix: 'View',
  },
  properties: {
    viewModelPattern: {
      type: 'string',
      description:
        "Regular expression the screen's one hook must match. Default `^use[A-Z]\\w*ViewModel$`.",
    },
    screenSuffix: {
      type: 'string',
      description:
        "Suffix removed from a screen's name to name its own view (`RaceScreen` -> `Race`). Default `Screen`.",
    },
    viewSuffix: {
      type: 'string',
      description:
        'Suffix added to name the one component that may take the whole view model (`Race` -> `RaceView`). Default `View`.',
    },
  },
} satisfies RuleSpec<ScreenSettings>;

export default createRule<Options, MessageIds>({
  name: RULE.name,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a screen to call exactly one view-model hook and never reach through it (Sandi Metz rule 4)',
    },
    schema: optionsSchema(RULE.properties),
    defaultOptions: [{}],
    messages: {
      exactlyOne:
        'Screen `{{name}}` calls {{n}} hooks. A screen calls exactly one view-model hook; move other hooks inside it.',
      notViewModel:
        'Screen `{{name}}` must get its data from a view-model hook matching /{{pattern}}/, not `{{hook}}`.',
      binding:
        'Bind the view model to one identifier (`const vm = useXViewModel()`) or destructure it one level deep.',
      reachThrough:
        '`{{text}}` reaches through the view model. Pass the slice to a child component or add a property to the view model.',
      spread: 'Do not spread the view model into JSX; pass named slices.',
      wholeViewModel:
        "Pass `<{{name}}>` one slice of the view model, not all of it. Only the screen's own view `<{{view}} vm={vm} />` takes it whole.",
    },
  },
  create(context, [given]) {
    return screenListeners(context, resolveOptions(context, RULE, given));
  },
});
