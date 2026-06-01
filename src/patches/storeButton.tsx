import { executeInTab, callable, toaster } from "@decky/api";

const startDownload = callable<[number, string?], string>("start_download");
const findStoreTab = callable<[], string | null>("find_store_tab");

function getInjectedScript(): string {
  return `
(function() {
  if (window.__stplugin_injected) return;
  window.__stplugin_injected = true;

  const BUTTON_ID = 'stplugin-download-btn';
  let currentAppid = '';

  function getAppidFromUrl() {
    const path = window.location.pathname;
    const m = path.match(/\\/app\\/(\\d+)\\//);
    return m ? m[1] : null;
  }

  function findPurchaseSection(appid) {
    const forms = document.querySelectorAll('.game_area_purchase_game form');
    for (const form of forms) {
      const subidInput = form.querySelector('input[name="subid"]');
      if (subidInput && subidInput.value === appid) {
        return form.closest('.game_area_purchase_game');
      }
    }
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
      const oldBtn = document.getElementById(BUTTON_ID);
      if (oldBtn) oldBtn.remove();
    }
    const section = findPurchaseSection(appid);
    injectButton(section);
  }

  checkAndInject();

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
      retries = MAX_RETRIES;
    },
  };
}
