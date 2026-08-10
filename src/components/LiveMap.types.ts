/** Imperative handle exposed by both LiveMap.web.tsx and LiveMap.tsx (native no-op) so callers can trigger a recenter without reaching into platform-specific map internals. */
export interface LiveMapHandle {
  recenter: () => void;
}
