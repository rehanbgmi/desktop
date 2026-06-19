/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix AI Page Summarizer
 * Provides intelligent page content summarization with multiple modes:
 * brief, detailed, bullet points, and key takeaways.
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AIEngine: "chrome://aevumix/content/AIEngine.sys.mjs",
});

export class AevumixPageSummarizer {
  static PANEL_ID = "aevumix-summarizer-panel";

  constructor() {
    this._currentSummary = null;
    this._summaryMode = "brief";
    this._isProcessing = false;
  }

  init(window) {
    this._window = window;
    this._document = window.document;
    console.log("[Aevumix] AI Page Summarizer initialized");
  }

  /**
   * Summarize the current page with the specified mode.
   * @param {string} mode - "brief" | "detailed" | "bullets" | "takeaways"
   */
  async summarizePage(mode = "brief") {
    if (this._isProcessing) return;

    this._summaryMode = mode;
    this._isProcessing = true;
    this._showLoadingState();

    try {
      const pageContent = await this._extractPageContent();
      if (!pageContent) {
        this._showError("Unable to extract page content.");
        return;
      }

      const summary = await lazy.AIEngine.summarize({
        content: pageContent.text,
        title: pageContent.title,
        url: pageContent.url,
        mode: this._summaryMode,
        maxLength: this._getMaxLengthForMode(mode),
      });

      this._currentSummary = summary;
      this._displaySummary(summary);
    } catch (error) {
      console.error("[Aevumix] Summarization error:", error);
      this._showError("Failed to summarize page. Please try again.");
    } finally {
      this._isProcessing = false;
    }
  }

  /**
   * Extract readable content from the current page.
   */
  async _extractPageContent() {
    const browser = this._window.gBrowser.selectedBrowser;
    if (!browser || !browser.currentURI) return null;

    const url = browser.currentURI.spec;
    if (!url.startsWith("http")) return null;

    try {
      const title = browser.contentTitle || "";
      // Use Readability-like extraction via actor
      const actor = browser.browsingContext?.currentWindowGlobal?.getActor(
        "AevumixContent"
      );
      if (actor) {
        return await actor.sendQuery("Aevumix:GetPageContent");
      }

      // Fallback: basic content extraction
      return {
        url,
        title,
        text: await this._getBasicContent(browser),
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Basic content extraction fallback.
   */
  async _getBasicContent(browser) {
    try {
      return browser.contentDocument?.body?.innerText?.substring(0, 10000) || "";
    } catch (e) {
      return "";
    }
  }

  /**
   * Get maximum summary length based on mode.
   */
  _getMaxLengthForMode(mode) {
    switch (mode) {
      case "brief":
        return 150;
      case "detailed":
        return 800;
      case "bullets":
        return 500;
      case "takeaways":
        return 300;
      default:
        return 150;
    }
  }

  /**
   * Display the summary in a popup panel.
   */
  _displaySummary(summary) {
    this._hideLoadingState();

    const panel = this._createSummaryPanel(summary);
    const anchor = this._document.getElementById("aevumix-summarize-button");
    if (anchor) {
      panel.openPopup(anchor, "bottomcenter topright", 0, 0, false, false);
    }
  }

  /**
   * Create the summary popup panel.
   */
  _createSummaryPanel(summary) {
    const panel = this._document.createElement("panel");
    panel.id = AevumixPageSummarizer.PANEL_ID;
    panel.classList.add("aevumix-summarizer-panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautohide", "true");

    // Header with mode tabs
    const header = this._document.createElement("hbox");
    header.classList.add("aevumix-summary-header");

    const modes = [
      { id: "brief", label: "Brief" },
      { id: "detailed", label: "Detailed" },
      { id: "bullets", label: "Bullets" },
      { id: "takeaways", label: "Key Points" },
    ];

    for (const mode of modes) {
      const tab = this._document.createElement("toolbarbutton");
      tab.classList.add("aevumix-summary-tab");
      if (mode.id === this._summaryMode) {
        tab.classList.add("aevumix-summary-tab-active");
      }
      tab.setAttribute("label", mode.label);
      tab.addEventListener("command", () => {
        this.summarizePage(mode.id);
      });
      header.appendChild(tab);
    }

    panel.appendChild(header);

    // Summary content
    const content = this._document.createElement("description");
    content.classList.add("aevumix-summary-content");
    content.textContent = summary.text;
    panel.appendChild(content);

    // Footer with actions
    const footer = this._document.createElement("hbox");
    footer.classList.add("aevumix-summary-footer");

    const copyBtn = this._document.createElement("toolbarbutton");
    copyBtn.setAttribute("label", "Copy");
    copyBtn.classList.add("aevumix-summary-action-btn");
    copyBtn.addEventListener("command", () => {
      this._copyToClipboard(summary.text);
    });
    footer.appendChild(copyBtn);

    const shareBtn = this._document.createElement("toolbarbutton");
    shareBtn.setAttribute("label", "Share");
    shareBtn.classList.add("aevumix-summary-action-btn");
    shareBtn.addEventListener("command", () => {
      this._shareSummary(summary);
    });
    footer.appendChild(shareBtn);

    panel.appendChild(footer);

    // Add to document
    const popupSet = this._document.getElementById("mainPopupSet");
    if (popupSet) {
      popupSet.appendChild(panel);
    }

    return panel;
  }

  /**
   * Show loading state in the summarizer button.
   */
  _showLoadingState() {
    const btn = this._document.getElementById("aevumix-summarize-button");
    if (btn) {
      btn.setAttribute("busy", "true");
      btn.setAttribute("tooltiptext", "Summarizing page...");
    }
  }

  /**
   * Hide loading state.
   */
  _hideLoadingState() {
    const btn = this._document.getElementById("aevumix-summarize-button");
    if (btn) {
      btn.removeAttribute("busy");
      btn.setAttribute("tooltiptext", "Summarize this page");
    }
  }

  /**
   * Show an error message.
   */
  _showError(message) {
    this._hideLoadingState();
    // Could show a notification or inline error
    console.warn("[Aevumix] Summarizer:", message);
  }

  /**
   * Copy summary text to clipboard.
   */
  async _copyToClipboard(text) {
    try {
      const clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
        Ci.nsIClipboardHelper
      );
      clipboard.copyString(text);
    } catch (e) {
      console.error("[Aevumix] Copy failed:", e);
    }
  }

  /**
   * Share summary via Web Share API or fallback.
   */
  _shareSummary(summary) {
    const browser = this._window.gBrowser.selectedBrowser;
    const shareData = {
      title: `Summary: ${browser.contentTitle}`,
      text: summary.text,
      url: browser.currentURI.spec,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      this._copyToClipboard(
        `${shareData.title}\n\n${shareData.text}\n\n${shareData.url}`
      );
    }
  }
}
