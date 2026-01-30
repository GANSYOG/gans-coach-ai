## 2025-05-18 - High Frequency Parent Updates
**Learning:** In this React app, `useLiveSession` drives `App` state updates at ~4Hz (volume) and 1Hz (timer). This causes aggressive re-rendering of the entire component tree.
**Action:** Always verify if high-frequency state hooks are at the root level and memoize static or expensive children (`Header`, `Transcript`) immediately to prevent performance degradation.
