// The single home of the named option-bag suffixes, shared by metz/max-params (a bag counts one
// per member) and the repo's flag-parameter ban (a bag holding a boolean is a flag). `*Props` is a
// max-params bag but not a flag bag: a boolean prop is a normal component prop.
export const BAG_SUFFIXES = ['Options', 'Opts', 'Params', 'Args'];

/** The default max-params bag pattern: props and option bags. */
export const DEFAULT_BAG_PATTERN = `(Props|${BAG_SUFFIXES.join('|')})$`;
