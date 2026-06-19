/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix Browser - Main Controller
 * Initializes and manages all Aevumix AI features.
 * Acts as the central hub connecting all AI components.
 */

import { AIEngine } from "chrome://aevumix/content/AIEngine.sys.mjs";
import { AevumixChatSidebar } from "chrome://aevumix/content/AevumixChatSidebar.sys.mjs";
import { AevumixPageSummarizer } from "chrome://aevumix/content/AevumixPageSummarizer.sys.mjs";
import { AevumixSmartSearch } from "chrome://aevumix/content/AevumixSmartSearch.sys.mjs";
import { AevumixWritingAssistant } from "chrome://aevumix/content/AevumixWritingAssistant.sys.mjs";
import { AevumixTabOrganizer } from "chrome://aevumix/content/AevumixTabOrganizer.sys.mjs";
import { AevumixTranslator } from "chrome://aevumix/content/AevumixTranslator.sys.mjs";

export class AevumixBrowser {
  static VERSION = "1.0.0";
  static BUILD_DATE = "2026-06-19";

  constructor() {
    this._initialized = false;
    this._chatSidebar = null;
    this._pageSummarizer = null;
    this._smartSearch = null;
    this._writingAssistant = null;
    this._tabOrganizer = null;
    this._translator = null;
  }

  /**
   * Initialize all Aevumix features for the given browser window.
   */
  init(window) {
    if (this._initialized) return;

    console.log(
      `[Aevumix] Initializing Aevumix Browser v${AevumixBrowser.VERSION}`
    );

    // Initialize core AI engine
    AIEngine.init();

    // Check if AI features are globally enabled
    const aiEnabled = Services.prefs.getBoolPref(
      "aevumix.ai.enabled",
      true
    );

    if (!aiEnabled) {
      console.log("[Aevumix] AI features are disabled in preferences.");
      return;
    }

    // Initialize each feature based on individual preferences
    this._initChatSidebar(window);
    this._initPageSummarizer(window);
    this._initSmartSearch(window);
    this._initWritingAssistant(window);
    this._initTabOrganizer(window);
    this._initTranslator(window);

    // Register toolbar buttons
    this._registerToolbarButtons(window);

    // Handle first run
    this._handleFirstRun(window);

    this._initialized = true;
    console.log("[Aevumix] All AI features initialized successfully");
  }

  /**
   * Initialize the AI Chat Sidebar.
   */
  _initChatSidebar(window) {
    if (!Services.prefs.getBoolPref("aevumix.ai.chat.enabled", true)) return;

    this._chatSidebar = new AevumixChatSidebar();
    this._chatSidebar.init(window);
  }

  /**
   * Initialize the AI Page Summarizer.
   */
  _initPageSummarizer(window) {
    if (
      !Services.prefs.getBoolPref("aevumix.ai.summarizer.enabled", true)
    )
      return;

    this._pageSummarizer = new AevumixPageSummarizer();
    this._pageSummarizer.init(window);
  }

  /**
   * Initialize the AI Smart Search.
   */
  _initSmartSearch(window) {
    if (!Services.prefs.getBoolPref("aevumix.ai.search.enabled", true))
      return;

    this._smartSearch = new AevumixSmartSearch();
    this._smartSearch.init(window);
  }

  /**
   * Initialize the AI Writing Assistant.
   */
  _initWritingAssistant(window) {
    if (!Services.prefs.getBoolPref("aevumix.ai.writing.enabled", true))
      return;

    this._writingAssistant = new AevumixWritingAssistant();
    this._writingAssistant.init(window);
  }

  /**
   * Initialize the AI Tab Organizer.
   */
  _initTabOrganizer(window) {
    if (!Services.prefs.getBoolPref("aevumix.ai.tabs.enabled", true))
      return;

    this._tabOrganizer = new AevumixTabOrganizer();
    this._tabOrganizer.init(window);

    // Enable auto-organize if configured
    if (
      Services.prefs.getBoolPref("aevumix.ai.tabs.auto_organize", false)
    ) {
      this._tabOrganizer.setAutoOrganize(true);
    }
  }

  /**
   * Initialize the AI Translator.
   */
  _initTranslator(window) {
    if (
      !Services.prefs.getBoolPref("aevumix.ai.translate.enabled", true)
    )
      return;

    this._translator = new AevumixTranslator();
    this._translator.init(window);
  }

  /**
   * Register Aevumix toolbar buttons in the browser UI.
   */
  _registerToolbarButtons(window) {
    const document = window.document;

    // AI Chat button
    this._ensureToolbarButton(document, {
      id: "aevumix-ai-chat-button",
      label: "Aevumix AI Chat",
      tooltiptext: "Open Aevumix AI Chat",
      command: () => this.toggleChatSidebar(window),
    });

    // Summarize button
    this._ensureToolbarButton(document, {
      id: "aevumix-summarize-button",
      label: "Summarize Page",
      tooltiptext: "Summarize this page with AI",
      command: () => this.summarizeCurrentPage(),
    });

    // Organize tabs button
    this._ensureToolbarButton(document, {
      id: "aevumix-organize-tabs-btn",
      label: "Organize Tabs",
      tooltiptext: "AI-organize your tabs",
      command: () => this.organizeTabs(),
    });

    // Translate button
    this._ensureToolbarButton(document, {
      id: "aevumix-translate-button",
      label: "Translate",
      tooltiptext: "Translate this page",
      command: () => this.translateCurrentPage(),
    });
  }

  /**
   * Ensure a toolbar button exists in the browser UI.
   */
  _ensureToolbarButton(document, config) {
    let button = document.getElementById(config.id);
    if (!button) {
      button = document.createXULElement("toolbarbutton");
      button.id = config.id;
      button.setAttribute("label", config.label);
      button.setAttribute("tooltiptext", config.tooltiptext);
      button.classList.add("toolbarbutton-1", "chromeclass-toolbar-additional");
      button.addEventListener("command", config.command);

      // Add to toolbar (prefer nav-bar)
      const navBar = document.getElementById("nav-bar");
      if (navBar) {
        navBar.appendChild(button);
      }
    }
  }

  /**
   * Handle first run experience.
   */
  _handleFirstRun(window) {
    const isFirstRun = Services.prefs.getBoolPref(
      "aevumix.first_run",
      true
    );

    if (isFirstRun) {
      console.log("[Aevumix] First run detected - showing welcome experience");

      // Open welcome tab
      window.gBrowser.addTab("about:aevumix-welcome", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });

      // Mark first run as complete
      Services.prefs.setBoolPref("aevumix.first_run", false);
    }
  }

  // === Public API ===

  /**
   * Toggle the AI Chat sidebar.
   */
  toggleChatSidebar(window) {
    if (this._chatSidebar) {
      const isOpen = Services.prefs.getBoolPref(
        "aevumix.ai.chat.sidebar.open",
        false
      );
      Services.prefs.setBoolPref(
        "aevumix.ai.chat.sidebar.open",
        !isOpen
      );

      if (!isOpen) {
        window.SidebarUI?.show("aevumix-chat-sidebar");
      } else {
        window.SidebarUI?.hide();
      }
    }
  }

  /**
   * Summarize the current page.
   */
  summarizeCurrentPage() {
    if (this._pageSummarizer) {
      this._pageSummarizer.summarizePage();
    }
  }

  /**
   * Organize open tabs with AI.
   */
  organizeTabs() {
    if (this._tabOrganizer) {
      this._tabOrganizer.organizeTabs();
    }
  }

  /**
   * Translate the current page.
   */
  translateCurrentPage() {
    if (this._translator) {
      this._translator.translatePage(
        Services.prefs.getStringPref("aevumix.ai.translate.target", "en")
      );
    }
  }

  /**
   * Get the status of all AI features.
   */
  getStatus() {
    return {
      version: AevumixBrowser.VERSION,
      initialized: this._initialized,
      features: {
        chatSidebar: !!this._chatSidebar,
        pageSummarizer: !!this._pageSummarizer,
        smartSearch: !!this._smartSearch,
        writingAssistant: !!this._writingAssistant,
        tabOrganizer: !!this._tabOrganizer,
        translator: !!this._translator,
      },
      aiEngine: AIEngine.getConfig(),
    };
  }

  /**
   * Disable all AI features.
   */
  shutdown() {
    if (this._chatSidebar) this._chatSidebar.clearConversation();
    if (this._smartSearch) this._smartSearch.clearCache();
    if (this._tabOrganizer) this._tabOrganizer.setEnabled(false);
    if (this._translator) this._translator.setEnabled(false);

    this._initialized = false;
    console.log("[Aevumix] Browser shutdown complete");
  }
}
