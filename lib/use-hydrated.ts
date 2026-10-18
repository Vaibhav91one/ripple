import { useSyncExternalStore } from "react";

const subscribeNone = () => () => {};

/** False during SSR and the hydrating render, true after. Gate anything read from a warm client cache (react-query) so the first client render matches the prerendered HTML (React #418). */
export const useHydrated = () => useSyncExternalStore(subscribeNone, () => true, () => false);
