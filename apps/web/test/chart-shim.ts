// jsdom has no ResizeObserver. Recharts' ResponsiveContainer observes its parent, so this test-only stub lets the
// charts mount; their size comes from `initialDimension`, as jsdom has no layout.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
