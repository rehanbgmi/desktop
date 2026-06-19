/**
 * Aevumix Test Harness
 * Provides mocks for Firefox browser APIs so modules can be tested in Node.js.
 */

// Mock Services (Firefox preferences, clipboard, etc.)
const mockPrefs = new Map();
const mockNotifications = [];

export const Services = {
  prefs: {
    getStringPref(key, fallback = "") {
      return mockPrefs.has(key) ? mockPrefs.get(key) : fallback;
    },
    setStringPref(key, value) {
      mockPrefs.set(key, value);
    },
    getBoolPref(key, fallback = false) {
      return mockPrefs.has(key) ? mockPrefs.get(key) === true : fallback;
    },
    setBoolPref(key, value) {
      mockPrefs.set(key, value);
    },
    getIntPref(key, fallback = 0) {
      return mockPrefs.has(key) ? mockPrefs.get(key) : fallback;
    },
    setIntPref(key, value) {
      mockPrefs.set(key, value);
    },
  },
  scriptSecurityManager: {
    getSystemPrincipal() {
      return { isSystemPrincipal: true };
    },
  },
};

// Mock ChromeUtils
export const ChromeUtils = {
  importESModule(url) {
    return {};
  },
  defineESModuleGetters(lazy, getters) {
    for (const [name, url] of Object.entries(getters)) {
      Object.defineProperty(lazy, name, {
        get() {
          return mockModules[name] || {};
        },
      });
    }
  },
};

// Mock module registry
export const mockModules = {};

export function registerMockModule(name, module) {
  mockModules[name] = module;
}

// Mock Cc/Ci (Component classes/interfaces)
export const Cc = {
  "@mozilla.org/widget/clipboardhelper;1": {
    getService() {
      return {
        copyString(text) {
          mockClipboard = text;
        },
      };
    },
  },
};

export const Ci = {
  nsIClipboardHelper: {},
};

let mockClipboard = "";

export function getClipboard() {
  return mockClipboard;
}

// Mock fetch
export function createMockFetch(responseData, ok = true, status = 200) {
  return async (url, options) => ({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => responseData,
    text: async () => JSON.stringify(responseData),
  });
}

// Mock AbortController
export class MockAbortController {
  constructor() {
    this.signal = { aborted: false };
  }
  abort() {
    this.signal.aborted = true;
  }
}

// Mock window and document
export function createMockWindow() {
  const elements = new Map();
  const listeners = new Map();

  const mockDoc = {
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        id: null,
        classList: {
          _classes: new Set(),
          add(...c) { c.forEach(x => this._classes.add(x)); },
          remove(...c) { c.forEach(x => this._classes.delete(x)); },
          contains(c) { return this._classes.has(c); },
        },
        setAttribute(k, v) { this[k] = v; },
        getAttribute(k) { return this[k]; },
        appendChild(child) { return child; },
        remove() {},
        querySelector(sel) { return null; },
        addEventListener(event, handler) {
          if (!listeners.has(event)) listeners.set(event, []);
          listeners.get(event).push(handler);
        },
        hidden: false,
        value: "",
        textContent: "",
        innerHTML: "",
        style: {},
      };
    },
    createXULElement(tag) {
      return this.createElement(tag);
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    activeElement: null,
  };

  const tabs = [];
  const mockWindow = {
    document: mockDoc,
    gBrowser: {
      selectedBrowser: {
        currentURI: { spec: "https://example.com/test-page" },
        contentTitle: "Test Page Title",
        contentDocument: {
          body: { innerText: "This is test page content for Aevumix testing." },
          documentElement: { getAttribute: () => "en" },
        },
        browsingContext: {
          currentWindowGlobal: {
            getActor: () => null,
          },
        },
      },
      tabs,
      tabContainer: {
        addEventListener(event, handler) {},
      },
      addTabsProgressListener(listener) {},
      getNotificationBox() {
        return {
          appendNotification(id, config) {
            mockNotifications.push({ id, config });
            return { close() {} };
          },
          getNotificationWithValue(id) {
            return mockNotifications.find((n) => n.id === id) || null;
          },
          PRIORITY_INFO_LOW: 1,
          PRIORITY_INFO_HIGH: 3,
          PRIORITY_WARNING_MEDIUM: 5,
        };
      },
      removeTab(tab) {},
      addTab(url, opts) {
        return { url };
      },
    },
    gURLBar: {
      inputField: {
        value: "",
        addEventListener(event, handler) {},
      },
      view: {
        addResult() {},
        removeResultsByType() {},
      },
    },
    SidebarUI: {
      show(id) {},
      hide() {},
    },
    _elements: elements,
  };

  return mockWindow;
}

// Reset all mocks
export function resetMocks() {
  mockPrefs.clear();
  mockNotifications.length = 0;
  mockClipboard = "";
  Object.keys(mockModules).forEach((k) => delete mockModules[k]);
}

// Simple test runner
let passed = 0;
let failed = 0;
let totalTests = 0;
const failures = [];

export function describe(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

export function it(name, fn) {
  totalTests++;
  try {
    fn();
    passed++;
    console.log(`    ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`    ✗ ${name}`);
    console.log(`      Error: ${error.message}`);
    failures.push({ name, error: error.message });
  }
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toContain(expected) {
      if (typeof actual === "string") {
        if (!actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to contain "${expected}"`);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
        }
      }
    },
    toBeInstanceOf(expected) {
      if (!(actual instanceof expected)) {
        throw new Error(`Expected instance of ${expected.name}`);
      }
    },
    toThrow() {
      let threw = false;
      try {
        actual();
      } catch (e) {
        threw = true;
      }
      if (!threw) throw new Error("Expected function to throw");
    },
    toBeDefined() {
      if (actual === undefined) throw new Error("Expected defined, got undefined");
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
  };
}

export function printResults() {
  console.log(`\n  ─────────────────────────────`);
  console.log(`  Tests: ${passed} passed, ${failed} failed, ${totalTests} total`);
  if (failures.length > 0) {
    console.log(`\n  Failures:`);
    for (const f of failures) {
      console.log(`    - ${f.name}: ${f.error}`);
    }
  }
  console.log();
  return { passed, failed, total: totalTests };
}
