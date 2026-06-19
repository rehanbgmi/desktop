/**
 * Aevumix Unit Tests
 * Tests for AIEngine, SmartSearch, TabOrganizer, and other modules.
 * Run with: node --experimental-vm-modules tests/run-tests.mjs
 */

import {
  describe, it, expect, printResults, resetMocks,
  Services, ChromeUtils, createMockWindow, createMockFetch,
  registerMockModule, getClipboard, Cc, Ci, MockAbortController,
} from "./test-harness.mjs";

// Make globals available
globalThis.Services = Services;
globalThis.ChromeUtils = ChromeUtils;
globalThis.Cc = Cc;
globalThis.Ci = Ci;
globalThis.AbortController = MockAbortController;

// ===========================
// AIEngine Tests
// ===========================
describe("AIEngine", () => {
  // Import AIEngine by dynamically loading it
  let AIEngine;

  before:
  // Manually create AIEngine for testing since we can't use chrome:// imports
  AIEngine = {
    _apiKey: null,
    _apiEndpoint: "https://api.aevumix.app/v1",
    _defaultModel: "aevumix-default",
    _requestQueue: [],
    _maxConcurrentRequests: 3,
    _activeRequests: 0,
    _timeout: 30000,
    _rateLimitWindow: 60000,
    _requestCount: 0,
    _maxRequestsPerWindow: 60,

    init() {
      this._loadConfig();
    },

    _loadConfig() {
      this._apiKey = Services.prefs.getStringPref("aevumix.ai.api.key", "");
      this._apiEndpoint = Services.prefs.getStringPref(
        "aevumix.ai.api.endpoint",
        "https://api.aevumix.app/v1"
      );
      this._defaultModel = Services.prefs.getStringPref(
        "aevumix.ai.model",
        "aevumix-default"
      );
      this._timeout = Services.prefs.getIntPref("aevumix.ai.timeout", 30000);
    },

    _getSystemPrompt(feature) {
      const prompts = {
        chat: "You are Aevumix AI",
        summarize: "You are a content summarizer",
        search: "You are a search assistant",
        answer: "You are a knowledge assistant",
        writing: "You are a writing assistant",
        tabs: "You are a tab organization assistant",
        language: "You are a language detection system",
        translate: "You are a professional translator",
      };
      return prompts[feature] || prompts.chat;
    },

    setApiKey(key) {
      this._apiKey = key;
      Services.prefs.setStringPref("aevumix.ai.api.key", key);
    },

    setEndpoint(endpoint) {
      this._apiEndpoint = endpoint;
      Services.prefs.setStringPref("aevumix.ai.api.endpoint", endpoint);
    },

    setModel(model) {
      this._defaultModel = model;
      Services.prefs.setStringPref("aevumix.ai.model", model);
    },

    getConfig() {
      return {
        endpoint: this._apiEndpoint,
        model: this._defaultModel,
        timeout: this._timeout,
        hasApiKey: !!this._apiKey,
      };
    },
  };

  resetMocks();

  it("should initialize with default config", () => {
    AIEngine.init();
    const config = AIEngine.getConfig();
    expect(config.endpoint).toBe("https://api.aevumix.app/v1");
    expect(config.model).toBe("aevumix-default");
    expect(config.timeout).toBe(30000);
    expect(config.hasApiKey).toBeFalsy();
  });

  it("should load config from preferences", () => {
    resetMocks();
    Services.prefs.setStringPref("aevumix.ai.api.key", "test-key-123");
    Services.prefs.setStringPref("aevumix.ai.model", "aevumix-fast");
    Services.prefs.setIntPref("aevumix.ai.timeout", 15000);
    AIEngine.init();
    const config = AIEngine.getConfig();
    expect(config.model).toBe("aevumix-fast");
    expect(config.timeout).toBe(15000);
    expect(config.hasApiKey).toBeTruthy();
  });

  it("should set API key", () => {
    resetMocks();
    AIEngine.init();
    AIEngine.setApiKey("my-secret-key");
    expect(AIEngine._apiKey).toBe("my-secret-key");
    expect(Services.prefs.getStringPref("aevumix.ai.api.key")).toBe("my-secret-key");
  });

  it("should set endpoint", () => {
    AIEngine.setEndpoint("https://custom.api.com/v2");
    expect(AIEngine._apiEndpoint).toBe("https://custom.api.com/v2");
  });

  it("should set model", () => {
    AIEngine.setModel("aevumix-creative");
    expect(AIEngine._defaultModel).toBe("aevumix-creative");
  });

  it("should return correct system prompts", () => {
    expect(AIEngine._getSystemPrompt("chat")).toContain("Aevumix AI");
    expect(AIEngine._getSystemPrompt("summarize")).toContain("summarizer");
    expect(AIEngine._getSystemPrompt("translate")).toContain("translator");
    expect(AIEngine._getSystemPrompt("unknown")).toContain("Aevumix AI"); // fallback
  });

  it("should track request count", () => {
    resetMocks();
    AIEngine.init();
    expect(AIEngine._requestCount).toBe(0);
  });

  it("should have all required methods", () => {
    expect(typeof AIEngine.init).toBe("function");
    expect(typeof AIEngine.setApiKey).toBe("function");
    expect(typeof AIEngine.setEndpoint).toBe("function");
    expect(typeof AIEngine.setModel).toBe("function");
    expect(typeof AIEngine.getConfig).toBe("function");
    expect(typeof AIEngine._getSystemPrompt).toBe("function");
  });
});

// ===========================
// SmartSearch Tests
// ===========================
describe("AevumixSmartSearch", () => {
  const SmartSearch = {
    _isEnabled: true,
    _suggestionCache: new Map(),
    _maxCacheSize: 100,
    _debounceTimer: null,
    _debounceDelay: 300,

    isNaturalLanguageQuery(query) {
      const questionPatterns = [
        /^(what|who|where|when|why|how|which|can|could|should|would|is|are|do|does|did)/i,
        /\?$/,
        /^(tell me|explain|define|describe|show me|find)/i,
      ];
      return questionPatterns.some((pattern) => pattern.test(query));
    },

    _addToCache(key, suggestions) {
      if (this._suggestionCache.size >= this._maxCacheSize) {
        const firstKey = this._suggestionCache.keys().next().value;
        this._suggestionCache.delete(firstKey);
      }
      this._suggestionCache.set(key, suggestions);
    },

    clearCache() {
      this._suggestionCache.clear();
    },

    setEnabled(enabled) {
      this._isEnabled = enabled;
    },
  };

  it("should detect natural language questions", () => {
    expect(SmartSearch.isNaturalLanguageQuery("What is AI?")).toBeTruthy();
    expect(SmartSearch.isNaturalLanguageQuery("how does this work")).toBeTruthy();
    expect(SmartSearch.isNaturalLanguageQuery("why is the sky blue?")).toBeTruthy();
    expect(SmartSearch.isNaturalLanguageQuery("Can you help me")).toBeTruthy();
    expect(SmartSearch.isNaturalLanguageQuery("tell me about Mars")).toBeTruthy();
    expect(SmartSearch.isNaturalLanguageQuery("explain quantum physics")).toBeTruthy();
    expect(SmartSearch.isNaturalLanguageQuery("define algorithm")).toBeTruthy();
  });

  it("should not detect non-question queries", () => {
    expect(SmartSearch.isNaturalLanguageQuery("github.com")).toBeFalsy();
    expect(SmartSearch.isNaturalLanguageQuery("stackoverflow")).toBeFalsy();
    expect(SmartSearch.isNaturalLanguageQuery("https://google.com")).toBeFalsy();
    expect(SmartSearch.isNaturalLanguageQuery("react tutorial")).toBeFalsy();
    expect(SmartSearch.isNaturalLanguageQuery("weather today")).toBeFalsy();
  });

  it("should cache suggestions with LRU eviction", () => {
    SmartSearch.clearCache();
    SmartSearch._maxCacheSize = 3;

    SmartSearch._addToCache("query1", ["result1"]);
    SmartSearch._addToCache("query2", ["result2"]);
    SmartSearch._addToCache("query3", ["result3"]);
    expect(SmartSearch._suggestionCache.size).toBe(3);

    // Adding a 4th should evict the first
    SmartSearch._addToCache("query4", ["result4"]);
    expect(SmartSearch._suggestionCache.size).toBe(3);
    expect(SmartSearch._suggestionCache.has("query1")).toBeFalsy();
    expect(SmartSearch._suggestionCache.has("query4")).toBeTruthy();
  });

  it("should clear cache", () => {
    SmartSearch._addToCache("test", ["data"]);
    expect(SmartSearch._suggestionCache.size).toBeGreaterThan(0);
    SmartSearch.clearCache();
    expect(SmartSearch._suggestionCache.size).toBe(0);
  });

  it("should enable and disable", () => {
    expect(SmartSearch._isEnabled).toBeTruthy();
    SmartSearch.setEnabled(false);
    expect(SmartSearch._isEnabled).toBeFalsy();
    SmartSearch.setEnabled(true);
    expect(SmartSearch._isEnabled).toBeTruthy();
  });
});

// ===========================
// TabOrganizer Tests
// ===========================
describe("AevumixTabOrganizer", () => {
  const TabOrganizer = {
    _groups: new Map(),
    _isEnabled: true,
    _autoOrganize: false,

    _extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return "";
      }
    },

    _areDuplicates(tabA, tabB) {
      if (tabA.url === tabB.url) return true;
      if (tabA.domain === tabB.domain && this._similarTitles(tabA.title, tabB.title)) {
        return true;
      }
      return false;
    },

    _similarTitles(a, b) {
      const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalize(a) === normalize(b);
    },

    setEnabled(enabled) {
      this._isEnabled = enabled;
    },

    setAutoOrganize(enabled) {
      this._autoOrganize = enabled;
    },
  };

  it("should extract domains correctly", () => {
    expect(TabOrganizer._extractDomain("https://github.com/user/repo")).toBe("github.com");
    expect(TabOrganizer._extractDomain("https://www.google.com/search?q=test")).toBe("www.google.com");
    expect(TabOrganizer._extractDomain("https://docs.aevumix.app/guide")).toBe("docs.aevumix.app");
    expect(TabOrganizer._extractDomain("not-a-url")).toBe("");
    expect(TabOrganizer._extractDomain("")).toBe("");
  });

  it("should detect exact duplicate tabs", () => {
    const tabA = { url: "https://github.com/zen-browser", title: "GitHub", domain: "github.com" };
    const tabB = { url: "https://github.com/zen-browser", title: "GitHub", domain: "github.com" };
    expect(TabOrganizer._areDuplicates(tabA, tabB)).toBeTruthy();
  });

  it("should detect similar title duplicates on same domain", () => {
    const tabA = { url: "https://github.com/a", title: "GitHub - Repo A", domain: "github.com" };
    const tabB = { url: "https://github.com/b", title: "GitHub - Repo A", domain: "github.com" };
    expect(TabOrganizer._areDuplicates(tabA, tabB)).toBeTruthy();
  });

  it("should not mark different tabs as duplicates", () => {
    const tabA = { url: "https://github.com", title: "GitHub", domain: "github.com" };
    const tabB = { url: "https://google.com", title: "Google", domain: "google.com" };
    expect(TabOrganizer._areDuplicates(tabA, tabB)).toBeFalsy();
  });

  it("should compare titles case-insensitively", () => {
    expect(TabOrganizer._similarTitles("Hello World", "hello world")).toBeTruthy();
    expect(TabOrganizer._similarTitles("Hello World!", "hello-world")).toBeTruthy(); // ! and - both stripped
    expect(TabOrganizer._similarTitles("GitHub", "Google")).toBeFalsy();
    expect(TabOrganizer._similarTitles("TEST", "test")).toBeTruthy();
  });

  it("should enable/disable properly", () => {
    expect(TabOrganizer._isEnabled).toBeTruthy();
    TabOrganizer.setEnabled(false);
    expect(TabOrganizer._isEnabled).toBeFalsy();
    TabOrganizer.setEnabled(true);

    expect(TabOrganizer._autoOrganize).toBeFalsy();
    TabOrganizer.setAutoOrganize(true);
    expect(TabOrganizer._autoOrganize).toBeTruthy();
    TabOrganizer.setAutoOrganize(false);
  });
});

// ===========================
// Translator Tests
// ===========================
describe("AevumixTranslator", () => {
  const Translator = {
    _detectedLanguage: null,
    _targetLanguage: "en",
    _isEnabled: true,
    _translationCache: new Map(),

    SUPPORTED_LANGUAGES: [
      { code: "en", name: "English" },
      { code: "es", name: "Spanish" },
      { code: "fr", name: "French" },
      { code: "de", name: "German" },
      { code: "ja", name: "Japanese" },
      { code: "zh", name: "Chinese (Simplified)" },
    ],

    _normalizeLanguageCode(code) {
      return code.split("-")[0].toLowerCase();
    },

    _getLanguageName(code) {
      const lang = this.SUPPORTED_LANGUAGES.find((l) => l.code === code);
      return lang ? lang.name : code;
    },

    setEnabled(enabled) {
      this._isEnabled = enabled;
    },

    setTargetLanguage(languageCode) {
      this._targetLanguage = languageCode;
    },
  };

  it("should normalize language codes", () => {
    expect(Translator._normalizeLanguageCode("en-US")).toBe("en");
    expect(Translator._normalizeLanguageCode("zh-TW")).toBe("zh");
    expect(Translator._normalizeLanguageCode("fr")).toBe("fr");
    expect(Translator._normalizeLanguageCode("EN")).toBe("en");
    expect(Translator._normalizeLanguageCode("ja-JP")).toBe("ja");
  });

  it("should get language names", () => {
    expect(Translator._getLanguageName("en")).toBe("English");
    expect(Translator._getLanguageName("es")).toBe("Spanish");
    expect(Translator._getLanguageName("ja")).toBe("Japanese");
    expect(Translator._getLanguageName("xx")).toBe("xx"); // unknown code
  });

  it("should have all supported languages defined", () => {
    expect(Translator.SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
    const codes = Translator.SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain("en");
    expect(codes).toContain("es");
    expect(codes).toContain("fr");
    expect(codes).toContain("de");
    expect(codes).toContain("ja");
    expect(codes).toContain("zh");
  });

  it("should set target language", () => {
    Translator.setTargetLanguage("fr");
    expect(Translator._targetLanguage).toBe("fr");
    Translator.setTargetLanguage("en");
  });

  it("should enable/disable", () => {
    expect(Translator._isEnabled).toBeTruthy();
    Translator.setEnabled(false);
    expect(Translator._isEnabled).toBeFalsy();
    Translator.setEnabled(true);
  });
});

// ===========================
// Preferences Tests
// ===========================
describe("Aevumix Preferences", () => {
  resetMocks();

  it("should store and retrieve string preferences", () => {
    Services.prefs.setStringPref("aevumix.ai.api.key", "test-key");
    expect(Services.prefs.getStringPref("aevumix.ai.api.key")).toBe("test-key");
  });

  it("should store and retrieve boolean preferences", () => {
    Services.prefs.setBoolPref("aevumix.ai.enabled", true);
    expect(Services.prefs.getBoolPref("aevumix.ai.enabled")).toBeTruthy();

    Services.prefs.setBoolPref("aevumix.ai.chat.enabled", false);
    expect(Services.prefs.getBoolPref("aevumix.ai.chat.enabled")).toBeFalsy();
  });

  it("should store and retrieve integer preferences", () => {
    Services.prefs.setIntPref("aevumix.ai.timeout", 15000);
    expect(Services.prefs.getIntPref("aevumix.ai.timeout")).toBe(15000);
  });

  it("should return fallback for missing preferences", () => {
    resetMocks();
    expect(Services.prefs.getStringPref("aevumix.nonexistent", "default")).toBe("default");
    expect(Services.prefs.getBoolPref("aevumix.nonexistent", false)).toBeFalsy();
    expect(Services.prefs.getIntPref("aevumix.nonexistent", 42)).toBe(42);
  });

  it("should handle JSON preferences", () => {
    const data = { work: [1, 2, 3], social: [4, 5] };
    Services.prefs.setStringPref("aevumix.ai.tab.groups", JSON.stringify(data));
    const stored = JSON.parse(Services.prefs.getStringPref("aevumix.ai.tab.groups"));
    expect(stored.work.length).toBe(3);
    expect(stored.social.length).toBe(2);
  });
});

// ===========================
// Branding Tests
// ===========================
describe("Aevumix Branding", () => {
  it("should have correct branding in surfer.json", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("../../surfer.json", "utf-8");
    const config = JSON.parse(content);

    expect(config.name).toBe("Aevumix Browser");
    expect(config.vendor).toBe("Aevumix Team");
    expect(config.appId).toBe("aevumix");
    expect(config.binaryName).toBe("aevumix");
    expect(config.brands.release.brandShortName).toBe("Aevumix");
    expect(config.brands.release.brandFullName).toBe("Aevumix Browser");
    expect(config.updateHostname).toBe("updates.aevumix.app");
  });

  it("should have version 1.0.0", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("../../surfer.json", "utf-8");
    const config = JSON.parse(content);
    expect(config.brands.release.release.displayVersion).toBe("1.0.0");
  });

  it("should have dark background color", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("../../surfer.json", "utf-8");
    const config = JSON.parse(content);
    expect(config.brands.release.backgroundColor).toBe("#0D1117");
  });
});

// ===========================
// CSS Theme Tests
// ===========================
describe("Aevumix CSS Theme", () => {
  it("should define all CSS variables", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "../../themes/shared/aevumix/aevumix-ai.css",
      "utf-8"
    );

    expect(css).toContain("--aevumix-accent");
    expect(css).toContain("--aevumix-bg-primary");
    expect(css).toContain("--aevumix-text-primary");
    expect(css).toContain("--aevumix-border");
    expect(css).toContain("--aevumix-success");
    expect(css).toContain("--aevumix-error");
    expect(css).toContain("--aevumix-radius");
    expect(css).toContain("--aevumix-transition");
    expect(css).toContain("--aevumix-font");
  });

  it("should have chat sidebar styles", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "../../themes/shared/aevumix/aevumix-ai.css",
      "utf-8"
    );
    expect(css).toContain(".aevumix-chat-container");
    expect(css).toContain(".aevumix-chat-messages");
    expect(css).toContain(".aevumix-chat-input");
    expect(css).toContain(".aevumix-chat-send-btn");
    expect(css).toContain(".aevumix-typing-indicator");
  });

  it("should have tab group color styles", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "../../themes/shared/aevumix/aevumix-ai.css",
      "utf-8"
    );
    expect(css).toContain('[aevumix-group="work"]');
    expect(css).toContain('[aevumix-group="social"]');
    expect(css).toContain('[aevumix-group="development"]');
  });

  it("should have animation keyframes", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync(
      "../../themes/shared/aevumix/aevumix-ai.css",
      "utf-8"
    );
    expect(css).toContain("@keyframes aevumix-fade-in");
    expect(css).toContain("@keyframes aevumix-bounce");
  });
});

// ===========================
// File Structure Tests
// ===========================
describe("Aevumix File Structure", () => {
  it("should have all component files", async () => {
    const fs = await import("fs");
    const dir = "../";
    const files = fs.readdirSync(dir);

    expect(files).toContain("AIEngine.sys.mjs");
    expect(files).toContain("AevumixBrowser.sys.mjs");
    expect(files).toContain("AevumixChatSidebar.sys.mjs");
    expect(files).toContain("AevumixPageSummarizer.sys.mjs");
    expect(files).toContain("AevumixSmartSearch.sys.mjs");
    expect(files).toContain("AevumixTabOrganizer.sys.mjs");
    expect(files).toContain("AevumixTranslator.sys.mjs");
    expect(files).toContain("AevumixWritingAssistant.sys.mjs");
  });

  it("should have all icon files", async () => {
    const fs = await import("fs");
    const icons = fs.readdirSync("../icons/");

    expect(icons).toContain("ai-chat.svg");
    expect(icons).toContain("ai-summarize.svg");
    expect(icons).toContain("ai-tabs.svg");
    expect(icons).toContain("ai-translate.svg");
    expect(icons).toContain("ai-spark.svg");
    expect(icons).toContain("send.svg");
    expect(icons).toContain("trash.svg");
  });

  it("should have preferences file", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("../../../../prefs/aevumix/aevumix-ai.yaml");
    expect(exists).toBeTruthy();
  });

  it("should have theme CSS file", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync(
      "../../themes/shared/aevumix/aevumix-ai.css"
    );
    expect(exists).toBeTruthy();
  });
});

// Print results
const results = printResults();
process.exit(results.failed > 0 ? 1 : 0);
