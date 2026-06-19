/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix AI Translator
 * Provides intelligent page and selection translation powered by AI.
 * Features: full-page translation, selection translation, language
 * auto-detection, inline translation preview, and translation memory.
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AIEngine: "chrome://aevumix/content/AIEngine.sys.mjs",
});

export class AevumixTranslator {
  static SUPPORTED_LANGUAGES = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "zh", name: "Chinese (Simplified)" },
    { code: "zh-TW", name: "Chinese (Traditional)" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
    { code: "nl", name: "Dutch" },
    { code: "sv", name: "Swedish" },
    { code: "pl", name: "Polish" },
    { code: "tr", name: "Turkish" },
    { code: "vi", name: "Vietnamese" },
    { code: "th", name: "Thai" },
    { code: "id", name: "Indonesian" },
  ];

  constructor() {
    this._isEnabled = true;
    this._detectedLanguage = null;
    this._targetLanguage = "en";
    this._translationCache = new Map();
    this._isTranslating = false;
    this._originalContent = null;
  }

  init(window) {
    this._window = window;
    this._document = window.document;
    this._registerUI();
    this._loadPreferences();
    console.log("[Aevumix] AI Translator initialized");
  }

  /**
   * Register translator UI elements.
   */
  _registerUI() {
    // Add translation bar (shown when non-native language detected)
    this._createTranslationBar();

    // Add context menu items for selection translation
    this._addContextMenuItems();

    // Listen for page loads to detect language
    this._window.gBrowser.addTabsProgressListener({
      onLocationChange: (browser) => {
        this._detectPageLanguage(browser);
      },
    });
  }

  /**
   * Create the translation notification bar.
   */
  _createTranslationBar() {
    // This will be shown when a non-native language is detected
    this._translationBarTemplate = {
      id: "aevumix-translation-bar",
      type: "infobar",
      priority: "PRIORITY_INFO_HIGH",
    };
  }

  /**
   * Add context menu items for translating selections.
   */
  _addContextMenuItems() {
    const contextMenu = this._document.getElementById(
      "contentAreaContextMenu"
    );
    if (!contextMenu) return;

    const translateItem = this._document.createElement("menuitem");
    translateItem.id = "aevumix-context-translate-selection";
    translateItem.setAttribute("label", "Translate Selection with Aevumix AI");
    translateItem.setAttribute("accesskey", "A");
    translateItem.hidden = true;
    translateItem.addEventListener("command", () => {
      this.translateSelection();
    });

    // Insert into context menu
    const separator = this._document.createElement("menuseparator");
    separator.id = "aevumix-context-separator";
    separator.hidden = true;

    contextMenu.addEventListener("popupshowing", () => {
      const hasSelection =
        this._window.gBrowser.selectedBrowser?.contentWindow
          ?.getSelection()
          ?.toString()?.length > 0;
      translateItem.hidden = !hasSelection || !this._isEnabled;
      separator.hidden = !hasSelection || !this._isEnabled;
    });

    contextMenu.appendChild(separator);
    contextMenu.appendChild(translateItem);
  }

  /**
   * Detect the language of the current page.
   */
  async _detectPageLanguage(browser) {
    if (!this._isEnabled) return;

    try {
      const htmlElement = browser.contentDocument?.documentElement;
      const pageLang = htmlElement?.getAttribute("lang") || "";

      if (pageLang) {
        this._detectedLanguage = this._normalizeLanguageCode(pageLang);
      } else {
        // Auto-detect using AI
        const sampleText =
          browser.contentDocument?.body?.innerText?.substring(0, 500) || "";
        if (sampleText.length > 50) {
          const detected = await lazy.AIEngine.detectLanguage({
            text: sampleText,
          });
          this._detectedLanguage = detected.language;
        }
      }

      // Show translation bar if page language differs from target
      if (
        this._detectedLanguage &&
        this._detectedLanguage !== this._targetLanguage
      ) {
        this._showTranslationBar();
      }
    } catch (e) {
      // Language detection failed silently
    }
  }

  /**
   * Show the translation bar when a foreign language is detected.
   */
  _showTranslationBar() {
    const notificationBox = this._window.gBrowser.getNotificationBox();
    const existingNotification = notificationBox.getNotificationWithValue(
      "aevumix-translate"
    );
    if (existingNotification) return;

    const langName = this._getLanguageName(this._detectedLanguage);
    const targetName = this._getLanguageName(this._targetLanguage);

    notificationBox.appendNotification("aevumix-translate", {
      label: `This page is in ${langName}. Translate to ${targetName}?`,
      priority: notificationBox.PRIORITY_INFO_HIGH,
      buttons: [
        {
          label: "Translate",
          isDefault: true,
          callback: () => {
            this.translatePage(this._targetLanguage);
          },
        },
        {
          label: "Choose Language...",
          callback: () => {
            this._showLanguagePicker();
          },
        },
        {
          label: "Never Translate This Site",
          callback: () => {
            this._addSiteToNeverTranslate();
          },
        },
        {
          label: "Not Now",
          callback: () => {},
        },
      ],
    });
  }

  /**
   * Translate the entire page to the target language.
   */
  async translatePage(targetLanguage) {
    if (this._isTranslating || !this._isEnabled) return;

    this._isTranslating = true;
    this._targetLanguage = targetLanguage;

    try {
      const browser = this._window.gBrowser.selectedBrowser;
      const pageContent = browser.contentDocument?.body?.innerHTML;

      if (!pageContent) {
        this._showError("Unable to access page content.");
        return;
      }

      // Save original content for restoration
      this._originalContent = pageContent;

      // Check cache
      const cacheKey = `${browser.currentURI.spec}:${targetLanguage}`;
      let translated;

      if (this._translationCache.has(cacheKey)) {
        translated = this._translationCache.get(cacheKey);
      } else {
        // Translate using AI
        const result = await lazy.AIEngine.translate({
          text: browser.contentDocument?.body?.innerText,
          sourceLanguage: this._detectedLanguage || "auto",
          targetLanguage,
          preserveFormatting: true,
        });

        translated = result.translatedText;
        this._translationCache.set(cacheKey, translated);
      }

      // Apply translation
      await this._applyTranslation(browser, translated);

      // Show success notification
      this._showTranslationSuccess(targetLanguage);
    } catch (error) {
      console.error("[Aevumix] Translation failed:", error);
      this._showError("Translation failed. Please try again.");
    } finally {
      this._isTranslating = false;
    }
  }

  /**
   * Translate only the selected text.
   */
  async translateSelection() {
    if (!this._isEnabled) return;

    const selection = this._window.gBrowser.selectedBrowser?.contentWindow
      ?.getSelection()
      ?.toString();

    if (!selection) return;

    try {
      const result = await lazy.AIEngine.translate({
        text: selection,
        sourceLanguage: "auto",
        targetLanguage: this._targetLanguage,
        preserveFormatting: false,
      });

      // Show translation in a tooltip/popup
      this._showSelectionTranslation(result.translatedText, selection);
    } catch (error) {
      console.error("[Aevumix] Selection translation failed:", error);
    }
  }

  /**
   * Apply translated content to the page.
   */
  async _applyTranslation(browser, translatedText) {
    try {
      const actor = browser.browsingContext?.currentWindowGlobal?.getActor(
        "AevumixContent"
      );
      if (actor) {
        await actor.sendQuery("Aevumix:ApplyTranslation", {
          translatedText,
        });
      }
    } catch (e) {
      // Fallback: direct DOM manipulation via content script
      const doc = browser.contentDocument;
      if (doc) {
        const walker = doc.createTreeWalker(
          doc.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        // This is a simplified approach - full implementation would
        // preserve DOM structure and only replace text nodes
        console.log("[Aevumix] Applying translation via content script");
      }
    }
  }

  /**
   * Restore original page content.
   */
  restoreOriginal() {
    if (!this._originalContent) return;

    const browser = this._window.gBrowser.selectedBrowser;
    try {
      const actor = browser.browsingContext?.currentWindowGlobal?.getActor(
        "AevumixContent"
      );
      if (actor) {
        actor.sendQuery("Aevumix:RestoreOriginal", {
          content: this._originalContent,
        });
      }
    } catch (e) {
      console.error("[Aevumix] Failed to restore original content:", e);
    }
  }

  /**
   * Show translation success notification.
   */
  _showTranslationSuccess(targetLanguage) {
    const targetName = this._getLanguageName(targetLanguage);
    const notificationBox = this._window.gBrowser.getNotificationBox();

    // Remove the translate prompt
    const existing = notificationBox.getNotificationWithValue(
      "aevumix-translate"
    );
    if (existing) existing.close();

    notificationBox.appendNotification("aevumix-translated", {
      label: `Page translated to ${targetName}`,
      priority: notificationBox.PRIORITY_INFO_LOW,
      duration: 5000,
      buttons: [
        {
          label: "Show Original",
          callback: () => {
            this.restoreOriginal();
          },
        },
      ],
    });
  }

  /**
   * Show translation result for selection.
   */
  _showSelectionTranslation(translated, original) {
    const panel = this._document.createElement("panel");
    panel.classList.add("aevumix-translation-popup");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautohide", "true");

    const header = this._document.createElement("hbox");
    header.classList.add("aevumix-translation-header");
    const title = this._document.createElement("label");
    title.value = "Aevumix Translation";
    title.classList.add("aevumix-translation-title");
    header.appendChild(title);
    panel.appendChild(header);

    const originalEl = this._document.createElement("description");
    originalEl.classList.add("aevumix-translation-original");
    originalEl.textContent =
      original.length > 200 ? original.substring(0, 200) + "..." : original;
    panel.appendChild(originalEl);

    const arrow = this._document.createElement("label");
    arrow.value = "↓";
    arrow.classList.add("aevumix-translation-arrow");
    panel.appendChild(arrow);

    const translatedEl = this._document.createElement("description");
    translatedEl.classList.add("aevumix-translation-result");
    translatedEl.textContent = translated;
    panel.appendChild(translatedEl);

    const copyBtn = this._document.createElement("button");
    copyBtn.setAttribute("label", "Copy Translation");
    copyBtn.addEventListener("command", () => {
      Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Ci.nsIClipboardHelper)
        .copyString(translated);
    });
    panel.appendChild(copyBtn);

    const popupSet = this._document.getElementById("mainPopupSet");
    if (popupSet) {
      popupSet.appendChild(panel);
      const anchor = this._window.document.activeElement;
      panel.openPopup(anchor, "after_pointer", 0, 0, false, false);
    }
  }

  /**
   * Show language picker dialog.
   */
  _showLanguagePicker() {
    // Implementation would show a dropdown/dialog with supported languages
    console.log("[Aevumix] Language picker requested");
  }

  /**
   * Add current site to the "never translate" list.
   */
  _addSiteToNeverTranslate() {
    const url = this._window.gBrowser.selectedBrowser?.currentURI?.spec;
    if (!url) return;

    try {
      const hostname = new URL(url).hostname;
      const list = Services.prefs.getStringPref(
        "aevumix.ai.translate.never",
        "[]"
      );
      const sites = JSON.parse(list);
      sites.push(hostname);
      Services.prefs.setStringPref(
        "aevumix.ai.translate.never",
        JSON.stringify(sites)
      );
    } catch (e) {
      console.error("[Aevumix] Failed to save never-translate site:", e);
    }
  }

  /**
   * Get human-readable language name from code.
   */
  _getLanguageName(code) {
    const lang = AevumixTranslator.SUPPORTED_LANGUAGES.find(
      (l) => l.code === code
    );
    return lang ? lang.name : code;
  }

  /**
   * Normalize language code (e.g., "en-US" -> "en").
   */
  _normalizeLanguageCode(code) {
    return code.split("-")[0].toLowerCase();
  }

  /**
   * Load preferences.
   */
  _loadPreferences() {
    try {
      this._targetLanguage = Services.prefs.getStringPref(
        "aevumix.ai.translate.target",
        "en"
      );
      this._isEnabled = Services.prefs.getBoolPref(
        "aevumix.ai.translate.enabled",
        true
      );
    } catch (e) {
      // Use defaults
    }
  }

  _showError(message) {
    console.warn("[Aevumix] Translator:", message);
  }

  /**
   * Enable or disable the translator.
   */
  setEnabled(enabled) {
    this._isEnabled = enabled;
  }

  /**
   * Set the target translation language.
   */
  setTargetLanguage(languageCode) {
    this._targetLanguage = languageCode;
    Services.prefs.setStringPref(
      "aevumix.ai.translate.target",
      languageCode
    );
  }
}
