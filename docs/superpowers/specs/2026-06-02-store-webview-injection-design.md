# Design Spec: Store Page Webview Injection (executeInTab)

**Date:** 2026-06-02
**Status:** Proposed
**Supersedes:** React patch approach in `src/patches/storeButton.tsx`

## 1. Problem

The original React patch (`storeButton.tsx`) targeted `module.Q` in `webpackChunksteamui` but this component never renders on a store game page. Investigation (2026-06-02) confirmed that on Windows Desktop Steam with BPM overlay, the store game page is an **embedded CEF webview** loading `store.steampowered.com` directly. React patching cannot cross the webview boundary — the store page HTML is server-rendered, not React components.

## 2. Solution

Use Decky's `executeInTab()` (CDP injection) to run a DOM manipulation script inside the store webview. The injected script uses `MutationObserver` to detect game pages, extracts the appid from `window.location`, finds the matching purchase section, and inserts an "Add via LuaTools" button. Communication back to the React plugin is via `window.postMessage`.

## 3. Architecture

```
┌─ BPM Overlay (GamepadUI) ──────────────────────────────────┐
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Plugin (index.tsx + storeButton.tsx replacement)     │  │
│  │                                                      │  │
│  │  1. On load: fetch http://localhost:8080/json       │  │
│  │     → find tab where url contains                    │  │
│  │       "store.steampowered.com" & type === "page"     │  │
│  │                                                      │  │
│  │  2. executeInTab(tabId, false, injectedScript)       │  │
│  │     → runs in webview JS context                     │  │
│  │                                                      │  │
│  │  3. Listen for postMessage({ stplugin_download })    │  │
│  │     → call startDownload(appid), show toast          │  │
│  │                                                      │  │
│  │  4. On dismount: unpatch, remove message listener    │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ▲                                │
│                    postMessage                              │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Store Webview (separate CEF JS context)             │  │
│  │                                                      │  │
│  │  injectedScript:                                     │  │
│  │    • MutationObserver on document.body               │  │
│  │    • Parse appid from window.location.pathname       │  │
│  │    • Find .game_area_purchase_game matching appid    │  │
│  │    • Insert button after <h2 class="title">          │  │
│  │    • On click: postMessage({stplugin_download})      │  │
│  │    • Guard: check #stplugin-btn doesn't exist        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  store.steampowered.com HTML (server-rendered)       │  │
│  │  <div class="game_area_purchase_game">              │  │
│  │    <h2 class="title">Buy {Game}</h2>                 │  │
│  │    ← button injected here                             │  │
│  │    <div class="game_purchase_action">                │  │
│  │      <a class="btn_green_steamui">Add to Cart</a>   │  │
│  │    </div>                                            │  │
│  │  </div>                                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 4. Components

### 4.1 `src/patches/storeButton.tsx` — Rewrite

**Remove:** React patching logic (`findStoreModule`, `injectFCTrampoline`, `StoreButton` React component).

**Add:**

```typescript
// storeButton.tsx (new)
import { executeInTab, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");

interface CefTab {
  id: string;
  url: string;
  type: string;
  title: string;
}

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

function getInjectedScript(): string {
  return `
(function() {
  if (window.__stplugin_injected) return;
  window.__stplugin_injected = true;

  const BUTTON_ID = 'stplugin-download-btn';
  let currentAppid = '';

  function getAppidFromUrl() {
    const path = window.location.pathname;
    // /app/730/GameName/ or /agecheck/app/570/ or /sub/12345/
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
    // Fallback: first purchase section
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
      window.postMessage({ stplugin_download: currentAppid }, '*');
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
      console.log("[STPlugin] Store tab not found, retrying in", RETRY_MS, "ms (attempt", retries, ")");
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
      retries = MAX_RETRIES; // stop retries
    },
  };
}
```

### 4.2 `src/index.tsx` — No Changes Needed

The existing `registerStoreButtonPatch()` import and `storeButtonUnpatch?.unpatch?.()` in `onDismount` remain unchanged. The new implementation has the same interface: returns `{ unpatch }`.

## 5. Button Styling

Uses store.steampowered.com's native CSS classes:
- `btn_green_steamui` — green Steam button
- `btn_medium` — medium size
- Inline `marginBottom: 12px` — spacing from the title
- `display: inline-block` — proper button sizing

Matches the existing "Add to Cart" button appearance for native look.

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| `http://localhost:8080/json` unreachable | Log warning, stop retries |
| Store tab not found | Retry every 2s, up to 15 attempts (30s total) |
| `executeInTab` fails (invalid tab) | Tab may have closed; retry discovery |
| Store page has no purchase section | Button not shown (e.g., free games, wishlisted) |
| User navigates away from store | MutationObserver fires, appid not found, no button |
| Plugin reload | Injected script checks `window.__stplugin_injected`, won't double-inject |
| Script injects multiple times | Guard: `#stplugin-download-btn` ID check prevents duplicates |

## 7. Cross-Platform Path

| Platform | Store Rendering | Injection Method |
|----------|----------------|------------------|
| **Windows BPM Overlay** | CEF webview (store.steampowered.com) | `executeInTab` CDP injection (primary) |
| **SteamOS (Steam Deck)** | React components in GamepadUI | `executeInTab` may still work, but React patching would be cleaner |

Future enhancement: try React patching first, fall back to CDP injection if no component renders.

## 8. File Changes Summary

| File | Change |
|------|--------|
| `src/patches/storeButton.tsx` | **Rewrite** — remove React patching, add CDP injection logic |
| `src/index.tsx` | **No changes** — same import/interface |
| `AGENTS.md` | Already updated with store page architecture finding |

## 9. Communication Bridge

The injected webview script communicates with the React plugin via `window.parent.postMessage`. In CEF, `<webview>` content uses `window.parent` to reach the embedder window. The embedder (GamepadUI plugin) listens with `window.addEventListener('message', handler)`.

```
webview script → window.parent.postMessage({ stplugin_download: "730" }, '*')
                    ↓
GamepadUI window → addEventListener('message', handler)
                    ↓
Plugin → startDownload(730) → Toast notification
```

If `window.parent` is `null` (process-isolated `<webview>` with no parent reference), fallback to a polling approach: the injected script sets a hash on the webview URL (`#stplugin_730`), and either (a) the plugin polls the CDP endpoint for URL changes, or (b) the `module.Q` React wrapper listens for webview `urlchange` events and dispatches to the plugin.

## 10. Pre-Flight Diagnostic

Before implementing the CDP approach, run this in the Steam BPM console while on a store game page to confirm the store is a webview (not inline React):

```javascript
const patterns = ["game_area_purchase_game", "game_purchase_price", "btn_green_steamui", "btn_addtocart"];
for (const p of patterns) {
  const found = findModuleExport((e) => e?.toString?.()?.includes(p));
  console.log(found ? `FOUND "${p}"` : `NOT FOUND "${p}"`);
}
```

**If all return NOT FOUND:** Store is definitively a webview. Proceed with `executeInTab`.
**If any return FOUND:** Store is inline React. Patch that component instead of `module.Q`.

## 11. Verification Plan

1. Build: `pnpm run build`
2. Deploy to Windows Decky
3. Open Steam BPM overlay → Store tab → Navigate to a game page
4. Confirm: "Add via LuaTools" button appears after title in purchase section
5. Click button → confirm toast "Downloading Lua for App {appid}..."
6. Check QAM → Installed Scripts → confirm app appears
7. Navigate to a different game → confirm button updates
8. Reload plugin → confirm button still works (re-injected)
9. Navigate to non-game store page (store front, search) → button not present
