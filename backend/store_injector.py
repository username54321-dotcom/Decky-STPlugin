"""CDP WebSocket injection manager for Steam store page button.

Discovers the store webview via Chrome DevTools Protocol, opens a persistent
WebSocket connection, registers a click binding, and injects a button script.
Bridges button clicks to the Decky frontend via decky.emit().
"""

from __future__ import annotations

import asyncio
import json
import logging

import decky
import httpx

logger = logging.getLogger("StoreInjector")


INJECTED_SCRIPT = """\
(function() {
    if (window.__stplugin_injected) return;
    window.__stplugin_injected = true;

    var BUTTON_ID = 'stplugin-download-btn';
    var currentAppid = '';

    function getAppidFromUrl() {
        var path = window.location.pathname;
        var m = path.match(/\\/app\\/(\\d+)\\//);
        return m ? m[1] : null;
    }

    function findPurchaseSection(appid) {
        var forms = document.querySelectorAll('.game_area_purchase_game form');
        for (var i = 0; i < forms.length; i++) {
            var subidInput = forms[i].querySelector('input[name="subid"]');
            if (subidInput && subidInput.value === appid) {
                return forms[i].closest('.game_area_purchase_game');
            }
        }
        return document.querySelector('.game_area_purchase_game');
    }

    function injectButton(section) {
        if (!section) return;
        if (document.getElementById(BUTTON_ID)) return;

        var title = section.querySelector('h2.title');
        if (!title) return;

        var btn = document.createElement('a');
        btn.id = BUTTON_ID;
        btn.className = 'btn_green_steamui btn_medium';
        btn.style.marginBottom = '12px';
        btn.style.display = 'inline-block';
        btn.textContent = 'Add via LuaTools';
        btn.onclick = function(e) {
            e.preventDefault();
            if (typeof __stplugin_download === 'function') {
                __stplugin_download(currentAppid);
            }
        };

        title.parentNode.insertBefore(btn, title.nextSibling);
        console.log('[STPlugin] Button injected for app', currentAppid);
    }

    function checkAndInject() {
        var appid = getAppidFromUrl();
        if (!appid) return;
        if (appid !== currentAppid) {
            currentAppid = appid;
            var oldBtn = document.getElementById(BUTTON_ID);
            if (oldBtn) oldBtn.remove();
        }
        var section = findPurchaseSection(appid);
        injectButton(section);
    }

    checkAndInject();

    var observer = new MutationObserver(checkAndInject);
    observer.observe(document.body, { childList: true, subtree: true });

    var lastUrl = window.location.href;
    new MutationObserver(function() {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            currentAppid = '';
            setTimeout(checkAndInject, 500);
        }
    }).observe(document.querySelector('head') || document.documentElement, {
        childList: true, subtree: false
    });

    console.log('[STPlugin] Store injection script loaded (CDP mode)');
})();
"""


class StoreInjector:
    """Manages CDP connection to Steam store webview for button injection.

    Discovers the store webview via http://localhost:8080/json, opens a
    persistent WebSocket connection, registers a CDP binding for click
    callbacks, injects a DOM manipulation script, and bridges clicks
    to the frontend via decky.emit().
    """

    DISCOVERY_INTERVAL = 3  # seconds between discovery polls
    RECONNECT_DELAY = 2     # seconds to wait after WebSocket closes

    def __init__(self) -> None:
        self._ws = None
        self._cmd_id = 0
        self._running = False
        self._discovery_task: asyncio.Task | None = None
        self._script_id: str | None = None

    async def start(self) -> None:
        """Start the discovery loop. Called from Plugin._main()."""
        self._running = True
        self._discovery_task = asyncio.create_task(self._discover_loop())
        logger.info("[StoreInjector] Started")

    async def stop(self) -> None:
        """Stop the injector and clean up. Called from Plugin._unload()."""
        self._running = False
        if self._discovery_task:
            self._discovery_task.cancel()
            try:
                await self._discovery_task
            except asyncio.CancelledError:
                pass
        if self._ws and not self._ws.closed:
            await self._ws.close()
        self._ws = None
        logger.info("[StoreInjector] Stopped")

    async def _discover_loop(self) -> None:
        """Periodically search for the store webview and inject when found."""
        while self._running:
            try:
                tab = await self._find_store_tab()
                if tab:
                    ws_url = tab.get("webSocketDebuggerUrl")
                    if ws_url:
                        logger.info(
                            "[StoreInjector] Found store tab: %s",
                            tab.get("title", "unknown"),
                        )
                        await self._connect_and_inject(ws_url)
                        # Connection closed — wait before retrying
                        await asyncio.sleep(self.RECONNECT_DELAY)
                    else:
                        logger.warning("[StoreInjector] Store tab has no WebSocket URL")
                        await asyncio.sleep(self.DISCOVERY_INTERVAL)
                else:
                    # No store tab found — user may not be on store page
                    await asyncio.sleep(self.DISCOVERY_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("[StoreInjector] Discovery error: %s", exc)
                await asyncio.sleep(self.DISCOVERY_INTERVAL)

    async def _find_store_tab(self) -> dict | None:
        """Query CDP targets for any tab with store.steampowered.com in the URL.

        Returns the full tab dict including webSocketDebuggerUrl, or None.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("http://localhost:8080/json")
                resp.raise_for_status()
                tabs = resp.json()
                for tab in tabs:
                    if isinstance(tab, dict):
                        url = tab.get("url", "")
                        if "store.steampowered.com" in url:
                            return tab
            return None
        except Exception as exc:
            logger.debug("[StoreInjector] CDP discovery failed: %s", exc)
            return None

    async def _connect_and_inject(self, ws_url: str) -> None:
        """Open CDP WebSocket, register binding, inject script, listen for events."""
        import websockets

        try:
            async with websockets.connect(ws_url) as ws:
                self._ws = ws
                self._cmd_id = 0
                logger.info("[StoreInjector] Connected to store webview")

                # 1. Enable Runtime domain (required for bindings)
                await self._send_cdp(ws, "Runtime.enable")

                # 2. Enable Page domain (required for addScriptToEvaluateOnNewDocument)
                await self._send_cdp(ws, "Page.enable")

                # 3. Register binding for download trigger
                await self._send_cdp(ws, "Runtime.addBinding", {
                    "name": "__stplugin_download",
                })

                # 4. Inject script to run on every page load/navigation
                result = await self._send_cdp(ws, "Page.addScriptToEvaluateOnNewDocument", {
                    "source": INJECTED_SCRIPT,
                })
                if result and "result" in result:
                    self._script_id = result["result"].get("identifier")

                logger.info("[StoreInjector] Script injected, listening for clicks")

                # 5. Listen for Runtime.bindingCalled events
                async for message in ws:
                    if not self._running:
                        break
                    try:
                        data = json.loads(message)
                        if data.get("method") == "Runtime.bindingCalled":
                            params = data.get("params", {})
                            if params.get("name") == "__stplugin_download":
                                payload = params.get("payload", "")
                                try:
                                    appid = int(payload)
                                    if appid > 0:
                                        logger.info(
                                            "[StoreInjector] Download triggered for app %d",
                                            appid,
                                        )
                                        await decky.emit("stplugin_store_download", str(appid))
                                except (ValueError, TypeError):
                                    logger.warning(
                                        "[StoreInjector] Invalid payload: %s",
                                        payload,
                                    )
                    except json.JSONDecodeError:
                        pass  # Skip non-JSON messages

        except websockets.exceptions.ConnectionClosed:
            logger.info("[StoreInjector] WebSocket connection closed")
        except Exception as exc:
            logger.error("[StoreInjector] Connection error: %s", exc)
        finally:
            self._ws = None

    async def _send_cdp(self, ws, method: str, params: dict | None = None) -> dict | None:
        """Send a CDP command and wait for the response with matching ID."""
        self._cmd_id += 1
        msg: dict = {"id": self._cmd_id, "method": method}
        if params:
            msg["params"] = params
        await ws.send(json.dumps(msg))

        # Wait for response with matching ID
        async for message in ws:
            try:
                data = json.loads(message)
                if data.get("id") == self._cmd_id:
                    return data
            except json.JSONDecodeError:
                pass
        return None
