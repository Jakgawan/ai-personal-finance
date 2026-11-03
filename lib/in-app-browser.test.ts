import { describe, it, expect } from "vitest"
import {
  detectBrowserKind,
  hasOpenExternalParam,
  addOpenExternalParam,
  removeOpenExternalParam,
  androidChromeIntentUrl,
} from "./in-app-browser"

const UA = {
  lineIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.20.0",
  lineAndroid: "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Line/13.20.0",
  fbIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/460.0.0.40.109;FBBV/588000000;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/th_TH;FBOP/5]",
  fbAndroid: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.40.109;]",
  igIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.30.109 (iPhone14,2; iOS 17_5; th_TH; th-TH; scale=3.00; 1170x2532; 600000000)",
  igAndroid: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Instagram 340.0.0.30.109 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; panther; en_US; 600000000)",
  androidWv: "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36",
  iosWv: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  chromeIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1",
  firefoxIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15",
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

describe("detectBrowserKind", () => {
  it("LINE iOS/Android -> line", () => {
    expect(detectBrowserKind(UA.lineIos, false)).toBe("line")
    expect(detectBrowserKind(UA.lineAndroid, false)).toBe("line")
  })
  it("Facebook/Instagram Android -> android-webview", () => {
    expect(detectBrowserKind(UA.fbAndroid, false)).toBe("android-webview")
    expect(detectBrowserKind(UA.igAndroid, false)).toBe("android-webview")
  })
  it("Facebook/Instagram iOS -> ios-webview", () => {
    expect(detectBrowserKind(UA.fbIos, false)).toBe("ios-webview")
    expect(detectBrowserKind(UA.igIos, false)).toBe("ios-webview")
  })
  it("generic webview", () => {
    expect(detectBrowserKind(UA.androidWv, false)).toBe("android-webview")
    expect(detectBrowserKind(UA.iosWv, false)).toBe("ios-webview")
  })
  it("normal browsers", () => {
    expect(detectBrowserKind(UA.safariIphone, false)).toBe("normal")
    expect(detectBrowserKind(UA.chromeAndroid, false)).toBe("normal")
    expect(detectBrowserKind(UA.chromeIos, false)).toBe("normal")
    expect(detectBrowserKind(UA.firefoxIos, false)).toBe("normal")
    expect(detectBrowserKind(UA.desktop, false)).toBe("normal")
  })
  it("standalone PWA -> normal even if UA looks like webview or LINE", () => {
    expect(detectBrowserKind(UA.iosWv, true)).toBe("normal")
    expect(detectBrowserKind(UA.lineIos, true)).toBe("normal")
  })
  it("iPadOS desktop-class UA (Macintosh, no Line) -> normal", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
    expect(detectBrowserKind(ua, false)).toBe("normal")
  })
  it("empty UA -> normal", () => {
    expect(detectBrowserKind("", false)).toBe("normal")
  })
})

describe("openExternalBrowser param helpers", () => {
  it("add keeps other params and hash", () => {
    const out = addOpenExternalParam("https://app.example.com/dash?a=1#top")
    expect(out).toBe("https://app.example.com/dash?a=1&openExternalBrowser=1#top")
  })
  it("add is idempotent", () => {
    const once = addOpenExternalParam("https://app.example.com/")
    expect(addOpenExternalParam(once)).toBe(once)
  })
  it("hasOpenExternalParam", () => {
    expect(hasOpenExternalParam("https://app.example.com/?openExternalBrowser=1")).toBe(true)
    expect(hasOpenExternalParam("https://app.example.com/?a=1")).toBe(false)
  })
  it("remove leaves clean URL", () => {
    expect(removeOpenExternalParam("https://app.example.com/?openExternalBrowser=1")).toBe("https://app.example.com/")
    expect(removeOpenExternalParam("https://app.example.com/x?a=1&openExternalBrowser=1#h")).toBe("https://app.example.com/x?a=1#h")
  })
  it("remove when param absent leaves URL unchanged", () => {
    expect(removeOpenExternalParam("https://app.example.com/x?a=1#h")).toBe("https://app.example.com/x?a=1#h")
  })
  it("invalid URL falls back safely", () => {
    expect(hasOpenExternalParam("not a url")).toBe(false)
    expect(addOpenExternalParam("not a url")).toBe("not a url")
    expect(removeOpenExternalParam("not a url")).toBe("not a url")
    expect(androidChromeIntentUrl("not a url")).toBe("not a url")
  })
  it("intent URL format", () => {
    expect(androidChromeIntentUrl("https://app.example.com/dash?a=1#top")).toBe(
      "intent://app.example.com/dash?a=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
        encodeURIComponent("https://app.example.com/dash?a=1#top") +
        ";end"
    )
    expect(androidChromeIntentUrl("http://localhost:3000/")).toBe(
      "intent://localhost:3000/#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=" +
        encodeURIComponent("http://localhost:3000/") +
        ";end"
    )
  })
})
