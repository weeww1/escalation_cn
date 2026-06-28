// ==UserScript==
// @name         Escalation CN Asset Redirect
// @namespace    https://github.com/weeww1/escalation_cn
// @version      0.7.1
// @description  Redirect Escalation Heroines WebGL AssetBundle requests to Chinese patched resources.
// @match        https://play.games.dmm.co.jp/*
// @match        *://*.games.dmm.co.jp/*
// @match        *://*.dmm.co.jp/*
// @match        *://*.e-heroines.net/*
// @match        *://e-heroines.net/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const RAW_BASE = "https://raw.githubusercontent.com/weeww1/escalation_cn/main";
  const FONT_BUILD = "layout-20260628";

  const REPLACE_MAP = {
    Manifest1Ex: `${RAW_BASE}/Manifest1Ex_cn`,
    Manifest2Ex: `${RAW_BASE}/Manifest2Ex_cn`,
    "bundle_font_64_dfudgothicpro6n-w6 sdf": `${RAW_BASE}/bundle_font_64_dfudgothicpro6n-w6%20sdf_cn_unity?v=${FONT_BUILD}`,
    bundle_scenarioscript_event_91: `${RAW_BASE}/bundle_scenarioscript_event_91_cn`,
    bundle_scenarioscript_char_358: `${RAW_BASE}/bundle_scenarioscript_char_358_cn`,
  };

  console.log("[EscalationCN] loaded:", location.href);

  function getUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function getAssetInfo(input) {
    const rawUrl = getUrl(input);
    if (!rawUrl) return null;

    let url;
    try {
      url = new URL(rawUrl, location.href);
    } catch (_) {
      return null;
    }

    const pathname = url.pathname;
    const encodedAssetName = pathname.substring(pathname.lastIndexOf("/") + 1);
    const assetName = decodeURIComponent(encodedAssetName);
    if (!Object.prototype.hasOwnProperty.call(REPLACE_MAP, assetName)) return null;
    if (
      !pathname.includes("/choukou/AssetBundles/") &&
      assetName !== "Manifest1Ex" &&
      assetName !== "Manifest2Ex"
    ) {
      return null;
    }

    const replacement = REPLACE_MAP[assetName];
    const cacheBust = `tm=${Date.now()}`;
    return {
      assetName,
      original: rawUrl,
      replacement: replacement.includes("?") ? `${replacement}&${cacheBust}` : `${replacement}?${cacheBust}`,
    };
  }

  function patchFetch() {
    if (typeof window.fetch !== "function") {
      console.log("[EscalationCN] fetch not found");
      return;
    }

    if (window.fetch.__escCnPatched) return;

    const originalFetch = window.fetch;

    async function patchedFetch(input, init) {
      const info = getAssetInfo(input);
      if (!info) return originalFetch.call(this, input, init);

      console.log("[EscalationCN] fetch redirect:", info.assetName, info.original, "=>", info.replacement);
      const response = await originalFetch.call(this, info.replacement, {
        ...init,
        method: "GET",
        cache: "no-store",
        credentials: "omit",
      });

      const len = response.headers && response.headers.get("content-length");
      console.log("[EscalationCN] fetch response:", info.assetName, response.status, response.statusText, "bytes=", len || "?");

      if (!response.ok) {
        console.warn("[EscalationCN] replacement failed, fallback original:", info.assetName);
        return originalFetch.call(this, input, init);
      }

      return response;
    }

    patchedFetch.__escCnPatched = true;
    window.fetch = patchedFetch;
    console.log("[EscalationCN] fetch patched");
  }

  function patchXhr() {
    if (typeof window.XMLHttpRequest !== "function") {
      console.log("[EscalationCN] XMLHttpRequest not found");
      return;
    }

    const proto = window.XMLHttpRequest.prototype;
    if (!proto || proto.open.__escCnPatched) return;

    const originalOpen = proto.open;

    proto.open = function patchedOpen(method, url, async, user, password) {
      const info = getAssetInfo(url);
      if (info) {
        console.log("[EscalationCN] xhr redirect:", info.assetName, info.original, "=>", info.replacement);
        this.__escCnAssetName = info.assetName;
        return originalOpen.call(this, "GET", info.replacement, async !== false, user, password);
      }

      return originalOpen.call(this, method, url, async, user, password);
    };

    const originalSend = proto.send;
    proto.send = function patchedSend(body) {
      if (this.__escCnAssetName) {
        this.addEventListener("loadend", function () {
          const len = this.response && (this.response.byteLength || this.response.length);
          console.log("[EscalationCN] xhr response:", this.__escCnAssetName, this.status, this.statusText, "bytes=", len || "?");
        });
      }

      return originalSend.call(this, body);
    };

    proto.open.__escCnPatched = true;
    console.log("[EscalationCN] xhr patched");
  }

  patchFetch();
  patchXhr();
})();
