// It hands a test what a call throws, for a
// message toThrow cannot pin: one built from a path or a row (toThrow takes only a regex literal
// or one of our error classes).

/** What `fn` throws. Throws itself when `fn` returns, so a test cannot pass on no error. */
export const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw, but it returned');
};
