import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during server render and the first client render, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
