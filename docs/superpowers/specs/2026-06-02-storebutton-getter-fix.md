# Fix Spec: Store Button Patch — Getter-Only Property Error

**Date:** 2026-06-02
**Status:** Draft
**Type:** Bug Fix

## 1. Problem

The STPlugin crashes on load with:

```
TypeError: Cannot set property Q of #<Object> which has only a getter
    at Module.afterPatch (patcher.js:17:21)
    at registerStoreButtonPatch (storeButton.tsx:74:19)
```

### 1.1 Root Cause

**Where:** `src/patches/storeButton.tsx:74`

```ts
const unpatch = afterPatch(
  info.module,      // webpack module object
  Key,              // export name (e.g. "Q") — getter-only property
  (args, ret) => { ... }
);
```

**Why:** Steam's webpack chunks define module exports using `Object.defineProperty` with getters (and no setters). When Decky's `afterPatch` tries to replace the property (`patcher.js` line 17: `object[property] = function(...)`), it fails because JavaScript prohibits assignment to getter-only properties.

**Relevant Decky source** (`node_modules/@decky/ui/dist/utils/patcher.js:15-17`):

```js
export function afterPatch(object, property, handler, options = {}) {
    const orig = object[property];    // Line 16 — reads getter (OK)
    object[property] = function (...args) {  // Line 17 — sets getter (FAILS)
```

The getter read on line 16 works fine — the module's export IS a React function component. The failure is on the assignment on line 17.

### 1.2 Affected Component

The store button patch, which injects an "Add via LuaTools" button into Steam's game page React component. Without this fix, the entire plugin fails to load.

## 2. Solution: `injectFCTrampoline`

### 2.1 Approach

Replace `afterPatch(info.module, Key, ...)` with Decky's **`injectFCTrampoline`**, the standard mechanism for wrapping function components that can't be directly patched.

**How `injectFCTrampoline` works** (from `fc.js:8-192`):

1. Takes a **function component** (not a module property) — we read it via the getter (which works fine)
2. **Mutates the function in-place**: adds `prototype.render`, `prototype.isReactComponent`, and React version-specific hooks (contextType, updater, etc.) — these make React treat the function like a class component
3. Creates a `userComponent = { component: newComponent }` wrapper (a plain object we control)
4. The injected `prototype.render` calls `createElement(userComponent.component, ...)` — resolving `.component` at render time
5. Returns `userComponent`

**The trick:** Because `prototype.render` always calls `userComponent.component` dynamically, we can swap `.component` on the returned object **without touching any getter**. React's rendering picks up the change on the next render cycle.

### 2.2 Code Change

**File:** `src/patches/storeButton.tsx`

**Import change (line 1):**
```diff
-import { findModuleDetailsByExport, afterPatch } from "@decky/ui";
+import { findModuleDetailsByExport, injectFCTrampoline } from "@decky/ui";
```

**Function change (lines 60-101):** Replace the existing `registerStoreButtonPatch` function with:

```tsx
export function registerStoreButtonPatch() {
  const info = findStoreModule();

  if (!info) {
    console.warn("[STPlugin] Could not find store game page component");
    console.warn(
      "[STPlugin] Desktop: expected webpackChunkstore; Steam Deck: expected webpackChunksteamui"
    );
    return;
  }

  const Key = info.exportName;
  console.log("[STPlugin] Found store component at module." + Key);

  // Read the component via the getter (OK — no assignment needed)
  const component = info.module[Key];

  if (typeof component !== "function") {
    console.warn(`[STPlugin] Expected function component at module.${Key}, got ${typeof component}`);
    return;
  }

  // Wrap via injectFCTrampoline — mutates component in-place, returns { component }
  const trampoline = injectFCTrampoline(component);
  const original = trampoline.component;

  // Replace the render target with our wrapper
  trampoline.component = function (props: any) {
    const ret = original.call(this, props);
    const appid = props?.id;

    if (!appid || !ret?.props) return ret;

    const btn = React.createElement(StoreButton, {
      key: "stplugin-download-btn",
      appid,
      isDLC: false,
    });

    const children = ret.props.children;
    if (children != null) {
      ret.props.children = [btn, children];
    } else {
      ret.props.children = btn;
    }

    return ret;
  };

  console.log("[STPlugin] Store button patch registered via injectFCTrampoline");

  // Return an unpatch function matching the existing contract
  return {
    unpatch: () => {
      trampoline.component = original;
      console.log("[STPlugin] Store button patch removed");
    },
  };
}
```

### 2.3 Key Differences from `afterPatch` Approach

| Aspect | Old (`afterPatch`) | New (`injectFCTrampoline`) |
|--------|-------------------|---------------------------|
| Target | `info.module` (module object) | `info.module[Key]` (the component value) |
| Assignment | Tries to set getter → crashes | Sets `.component` on a plain object → safe |
| Props access | `args?.[0]?.id` | `props?.id` (direct function arg) |
| Return | Already correct (React element) | Same — `original.call(this, props)` |

### 2.4 Unpatch

The wrapper returned by `registerStoreButtonPatch` already provides an `unpatch()` that restores `trampoline.component`. The call site in `index.tsx:76` (`storeButtonUnpatch?.unpatch?.()`) works unchanged.

Note: The prototype mutations applied by `injectFCTrampoline` (`.render`, `.isReactComponent`, property descriptors) remain on the component after unpatch. This is harmless — they're inert without the trampoline's render path being active. This follows standard Decky practice (the official docs only restore `.component`).

## 3. Edge Cases & Defensive Checks

### 3.1 `component` is not a function (new check)

```ts
if (typeof component !== "function") {
  console.warn(`[STPlugin] Expected function component at module.${Key}, got ${typeof component}`);
  return;
}
```

If the export is somehow a class component or non-function, we bail gracefully with a warning. This prevents `injectFCTrampoline` from being called on incompatible values.

### 3.2 `findStoreModule()` returns null

Already handled by existing bail-early logic (unchanged).

### 3.3 App ID is falsy or render output has no `.props`

Already handled by existing guard `if (!appid || !ret?.props) return ret;` (unchanged).

### 3.4 Desktop vs Steam Deck

Both code paths in `findStoreModule()` (line 20-49 for desktop `webpackChunkstore`, line 52-55 for Steam Deck `findModuleDetailsByExport`) return the same shape `{ module, exportName }`. The fix applies uniformly to both paths.

### 3.5 React 18 vs React 19

`injectFCTrampoline` handles both React 18 and React 19 runtime (conditioned on `window.SP_REACTDOM.version.startsWith("19.")` / `startsWith("18.")` in fc.js lines 61 and 129). No version-specific code is needed on our side.

## 4. Testing

### 4.1 Manual Verification

1. Load the plugin in Decky Loader
2. Confirm the plugin loads without the `Cannot set property` error
3. Navigate to a game's store page
4. Verify "Add via LuaTools" button appears
5. Click the button — verify download starts and toaster shows progress

### 4.2 What Doesn't Change

- Backend Python code — no changes needed
- QAM panels (Download, Installed, Settings) — unaffected
- Downloaded Lua script installation — unaffected
- Download progress toaster — unaffected
- The `StoreButton` inner component (lines 103-166) — completely unchanged

## 5. Impact Summary

| Concern | Assessment |
|---------|------------|
| Scope of change | 1 file, ~30 lines changed |
| Risk to other components | None — only affects store button patch |
| Backward compatibility | Same external contract (`{ unpatch }` returned) |
| Desktop Steam support | Same `webpackChunkstore` path, same fix |
| Steam Deck support | Same `findModuleDetailsByExport` path, same fix |
