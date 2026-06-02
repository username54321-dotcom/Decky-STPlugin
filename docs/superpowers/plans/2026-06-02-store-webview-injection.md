# Store Webview Injection (executeInTab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken React patching with `executeInTab` CDP injection to add a download button inside the store game page webview.

**Architecture:** Fetch CEF tab list from `http://localhost:8080/json` to find the store webview tab, inject a DOM manipulation script via `executeInTab()`, bridge communication back via `window.parent.postMessage`. Single file rewrite: `src/patches/storeButton.tsx`.

**Tech Stack:** TypeScript, `@decky/api` (executeInTab, callable, toaster), vanilla JS DOM manipulation (injected script)

---

### File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/patches/storeButton.tsx` | **Rewrite** | Tab discovery, script injection, message listener |

No other files change. `src/index.tsx` continues to import and call `registerStoreButtonPatch()` with the same interface.

---

### Task 1: Rewrite — Remove old code, add new scaffolding

**Files:**
- Modify: `src/patches/storeButton.tsx` — complete rewrite

- [ ] **Step 1: Delete entire old file content**

Remove all existing React patching code (`findStoreModule`, `injectFCTrampoline`, `StoreButton` component, the `ModuleInfo` interface, all `findModuleDetailsByExport` / `webpackChunkstore` logic, and the `StoreButton({ appid, isDLC })` function component with its download progress listener).

- [ ] **Step 2: Add new imports and scaffolding**

Write the file header with new imports and the `startDownload` callable:

```typescript
import { executeInTab, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");

// ── Tab Discovery ──

interface CefTab {
  id: string;
  url: string;
  type: string;
  title: string;
}
```

- [ ] **Step 3: Build to verify TypeScript compiles**

Run: `pnpm run build`
Expected: Build succeeds (exports are valid — `registerStoreButtonPatch` not yet defined but will be added next).

---

### Task 2: Implement tab discovery (`findStoreTab`)

**Files:**
- Modify: `src/patches/storeButton.tsx` — add `findStoreTab` function

- [ ] **Step 1: Add `findStoreTab` async function**

Append after the `CefTab` interface:

```typescript
async function findStoreTab(): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:8080/json");
    const tabs: CefTab[] = await res.json();
    const storeTab = tabs.find(
      (t) => t.url?.includes("store.steampowered.com") && t.type === "page"
    );
    return storeTab?.id ?? null;
  } catch (e) {
    console.warn("[STPlugin] Failed to query CDP tabs:", e);
    return null;
  }
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds.

---

### Task 3: Implement the injected script (`getInjectedScript`)

**Files:**
- Modify: `src/patches/storeButton.tsx` — add `getInjectedScript` function

- [ ] **Step 1: Add `getInjectedScript` function**

Append after `findStoreTab`:

```typescript
function getInjectedScript(): string {
  return `
(function() {
  if (window.__stplugin_injected) return;
  window.__stplugin_injected = true;

  const BUTTON_ID = 'stplugin-download-btn';
  let currentAppid = '';

  function getAppidFromUrl() {
    const path = window.location.pathname;
    // /app/730/GameName/ or /agecheck/app/570/
    const m = path.match(/\\/app\\/(\\d+)\\//);
    return m ? m[1] : null;
  }

  function findPurchaseSection(appid) {
    // Match <form> whose subid input matches the appid
    const forms = document.querySelectorAll('.game_area_purchase_game form');
    for (const form of forms) {
      const subidInput = form.querySelector('input[name="subid"]');
      if (subidInput && subidInput.value === appid) {
        return form.closest('.game_area_purchase_game');
      }
    }
    // Fallback: first purchase section on page
    return document.querySelector('.game_area_purchase_game');
  }

  function injectButton(section) {
    if (!section) return;
    if (document.getElementById(BUTTON_ID)) return;

    const title = section.querySelector('h2.title');
    if (!title) return;

    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.className = 'btn_green_steamui btn_medium';
    btn.style.marginBottom = '12px';
    btn.style.display = 'inline-block';
    btn.textContent = 'Add via LuaTools';
    btn.onclick = function(e) {
      e.preventDefault();
      window.parent.postMessage({ stplugin_download: currentAppid }, '*');
    };

    title.parentNode.insertBefore(btn, title.nextSibling);
    console.log('[STPlugin] Button injected for app', currentAppid);
  }

  function checkAndInject() {
    const appid = getAppidFromUrl();
    if (!appid) return;
    if (appid !== currentAppid) {
      currentAppid = appid;
      // Remove old button on URL change
      const oldBtn = document.getElementById(BUTTON_ID);
      if (oldBtn) oldBtn.remove();
    }
    const section = findPurchaseSection(appid);
    injectButton(section);
  }

  // Initial check
  checkAndInject();

  // Watch for URL/DOM changes
  const observer = new MutationObserver(checkAndInject);
  observer.observe(document.body, { childList: true, subtree: true });

  // Watch for SPA navigation (URL changes without page reload)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      currentAppid = '';
      setTimeout(checkAndInject, 500);
    }
  }).observe(document.querySelector('head') || document.documentElement, {
    childList: true, subtree: false
  });

  console.log('[STPlugin] Store injection script loaded');
})();
`;
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds.

---

### Task 4: Implement main export (`registerStoreButtonPatch`)

**Files:**
- Modify: `src/patches/storeButton.tsx` — add `registerStoreButtonPatch` export

- [ ] **Step 1: Add `registerStoreButtonPatch` function**

Append after `getInjectedScript`:

```typescript
export function registerStoreButtonPatch() {
  let tabId: string | null = null;
  let retries = 0;
  const MAX_RETRIES = 15;
  const RETRY_MS = 2000;

  function onMessage(event: MessageEvent) {
    if (event.data?.stplugin_download) {
      const appid = parseInt(event.data.stplugin_download, 10);
      if (isNaN(appid)) return;
      startDownload(appid).then(() => {
        toaster.toast({
          title: "STPlugin",
          body: `Downloading Lua for App ${appid}...`,
        });
      }).catch((err: any) => {
        toaster.toast({ title: "Error", body: err?.message || "Download failed" });
      });
    }
  }

  async function tryInject() {
    tabId = await findStoreTab();
    if (tabId) {
      await executeInTab(tabId, false, getInjectedScript());
      console.log("[STPlugin] Store injection script deployed to tab", tabId);
      return;
    }
    retries++;
    if (retries < MAX_RETRIES) {
      console.log(
        "[STPlugin] Store tab not found, retrying in",
        RETRY_MS,
        "ms (attempt",
        retries,
        ")"
      );
      setTimeout(tryInject, RETRY_MS);
    } else {
      console.warn("[STPlugin] Store tab not found after", MAX_RETRIES, "retries");
    }
  }

  tryInject();
  window.addEventListener("message", onMessage);

  return {
    unpatch: () => {
      window.removeEventListener("message", onMessage);
      retries = MAX_RETRIES; // stop the retry loop
    },
  };
}
```

- [ ] **Step 2: Verify the full file is complete**

The file should now contain (in order):
1. Imports from `@decky/api`
2. `startDownload` callable
3. `CefTab` interface
4. `findStoreTab()` async function
5. `getInjectedScript()` function
6. `registerStoreButtonPatch()` exported function

No React imports, no React components, no `injectFCTrampoline`, no `findModuleDetailsByExport`, no `webpackChunkstore`.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

---

### Task 5: Manual verification on Windows Decky

**Files:**
- None — verification only

- [ ] **Step 1: Deploy the built plugin**

Run: `pnpm run build:deploy`
(Or manually copy `dist/` to the Decky plugins directory)

- [ ] **Step 2: Restart BPM overlay or reload plugins**

Via Decky: Settings → Reload plugins, or restart Steam BPM.

- [ ] **Step 3: Check console logs for injection success**

Open Steam BPM console (F12 or Decky's dev tools). Expected log on plugin load:
```
[STPlugin] Store injection script deployed to tab <uuid>
```

If the store tab isn't available yet (user hasn't visited store), expect retry logs:
```
[STPlugin] Store tab not found, retrying in 2000 ms (attempt 1)
```
Then navigate to Store tab → expect injection log within 2s.

- [ ] **Step 4: Navigate to a store game page**

Go to Store → browse/search for a game → open its page.

Expected: After the purchase section renders, an "Add via LuaTools" green button appears after the `<h2 class="title">` element, styled like the native "Add to Cart" button.

- [ ] **Step 5: Click the button**

Click "Add via LuaTools".

Expected: Toast appears:
```
STPlugin
Downloading Lua for App {appid}...
```

And in console, the download pipeline starts (check backend logs or the QAM Download panel for progress).

- [ ] **Step 6: Verify navigation updates**

Navigate to a different game's store page.

Expected: Old button removed, new button appears for the new appid within ~500ms.

- [ ] **Step 7: Verify no button on non-game pages**

Navigate to the store front page (browse/search page, not a specific game).

Expected: No "Add via LuaTools" button visible.

- [ ] **Step 8: Reload plugin and re-verify**

Via Decky: Settings → Reload plugins.

Expected: Button re-injects after reload without double-injection (`window.__stplugin_injected` guard).

- [ ] **Step 9: Commit**

```bash
git add src/patches/storeButton.tsx docs/superpowers/plans/2026-06-02-store-webview-injection.md docs/superpowers/specs/2026-06-02-store-webview-injection-design.md
git commit -m "feat: replace React patch with executeInTab CDP injection for store page"
```

---

### Error Handling Summary (built-in)

| Scenario | Behavior |
|----------|----------|
| CDP endpoint unreachable | `findStoreTab` catches error, logs warning, retry loop stops |
| Store tab not found within 30s | Logs warning, stops retries, no UI impact |
| `executeInTab` fails | Error propagates; console will show the rejection |
| Store page has no purchase section | `injectButton` returns early (free games, wishlisted) |
| Plugin reload | `window.__stplugin_injected` guard prevents double-injection |
| postMessage bridge fails | Button appears but click does nothing; console error from `startDownload`
