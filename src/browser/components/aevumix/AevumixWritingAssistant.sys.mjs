/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix AI Writing Assistant
 * Provides AI-powered writing help in any text field across the web.
 * Features: grammar correction, tone adjustment, rewriting, completion,
 * expansion, shortening, and style suggestions.
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AIEngine: "chrome://aevumix/content/AIEngine.sys.mjs",
});

export class AevumixWritingAssistant {
  static CONTEXT_MENU_ID = "aevumix-writing-assistant-menu";

  constructor() {
    this._isEnabled = true;
    this._activeTarget = null;
    this._suggestionPanel = null;
  }

  init(window) {
    this._window = window;
    this._document = window.document;
    this._registerContextMenu();
    this._registerInlineAssistant();
    console.log("[Aevumix] AI Writing Assistant initialized");
  }

  /**
   * Register context menu items for writing assistance.
   */
  _registerContextMenu() {
    const contentAreaContextMenu = this._document.getElementById(
      "contentAreaContextMenu"
    );
    if (!contentAreaContextMenu) return;

    // Create AI Writing submenu
    const menu = this._document.createElement("menu");
    menu.id = AevumixWritingAssistant.CONTEXT_MENU_ID;
    menu.setAttribute("label", "Aevumix AI Writing");
    menu.setAttribute("accesskey", "W");
    menu.hidden = true;

    const popup = this._document.createElement("menupopup");

    const items = [
      {
        label: "Improve Writing",
        action: "improve",
        accesskey: "I",
      },
      {
        label: "Fix Grammar & Spelling",
        action: "grammar",
        accesskey: "G",
      },
      {
        label: "Make More Formal",
        action: "formal",
        accesskey: "F",
      },
      {
        label: "Make More Casual",
        action: "casual",
        accesskey: "C",
      },
      {
        label: "Make Shorter",
        action: "shorter",
        accesskey: "S",
      },
      {
        label: "Make Longer",
        action: "longer",
        accesskey: "L",
      },
      {
        label: "Simplify Language",
        action: "simplify",
        accesskey: "P",
      },
      {
        label: "Continue Writing...",
        action: "continue",
        accesskey: "O",
      },
      {
        label: "Translate Selection...",
        action: "translate",
        accesskey: "T",
      },
    ];

    for (const item of items) {
      const menuItem = this._document.createElement("menuitem");
      menuItem.setAttribute("label", item.label);
      menuItem.setAttribute("accesskey", item.accesskey);
      menuItem.classList.add("aevumix-writing-action");
      menuItem.addEventListener("command", () => {
        this._performAction(item.action);
      });
      popup.appendChild(menuItem);
    }

    menu.appendChild(popup);

    // Insert before "Inspect" item or at end
    const inspectItem = this._document.getElementById(
      "context-inspect-a11y"
    );
    if (inspectItem) {
      contentAreaContextMenu.insertBefore(menu, inspectItem);
    } else {
      contentAreaContextMenu.appendChild(menu);
    }

    // Show/hide menu based on text selection or text field
    contentAreaContextMenu.addEventListener("popupshowing", () => {
      this._updateContextMenuVisibility(menu);
    });
  }

  /**
   * Register inline assistant for real-time suggestions.
   */
  _registerInlineAssistant() {
    // Listen for text input in content area
    this._window.gBrowser.addTabsProgressListener({
      onLocationChange: (browser) => {
        this._setupContentListener(browser);
      },
    });
  }

  /**
   * Set up content script listener for a specific browser.
   */
  _setupContentListener(browser) {
    try {
      const actor = browser.browsingContext?.currentWindowGlobal?.getActor(
        "AevumixContent"
      );
      if (actor) {
        actor.sendQuery("Aevumix:InitWritingAssistant");
      }
    } catch (e) {
      // Actor not available yet
    }
  }

  /**
   * Update context menu visibility - only show when text is selected or in text field.
   */
  _updateContextMenuVisibility(menu) {
    if (!this._isEnabled) {
      menu.hidden = true;
      return;
    }

    const focusedElement = this._window.document.activeElement;
    const isTextField =
      focusedElement &&
      (focusedElement.tagName === "input" ||
        focusedElement.tagName === "textarea" ||
        focusedElement.isContentEditable);

    const hasSelection = this._window.gBrowser.selectedBrowser?.contentWindow
      ?.getSelection()
      ?.toString()?.length > 0;

    menu.hidden = !isTextField && !hasSelection;
  }

  /**
   * Perform a writing action on the selected/focused text.
   */
  async _performAction(action) {
    const text = await this._getTargetText();
    if (!text) return;

    this._activeTarget = text;
    this._showProcessingIndicator();

    try {
      const result = await lazy.AIEngine.writingAssist({
        text: text.content,
        action,
        context: {
          url: this._window.gBrowser.selectedBrowser?.currentURI?.spec,
          language: text.language || "en",
        },
      });

      this._showSuggestion(result, action);
    } catch (error) {
      console.error("[Aevumix] Writing assistant error:", error);
      this._showError("Writing assistance failed. Please try again.");
    } finally {
      this._hideProcessingIndicator();
    }
  }

  /**
   * Get the target text (selection or focused text field content).
   */
  async _getTargetText() {
    // Check for text selection first
    const selection =
      this._window.gBrowser.selectedBrowser?.contentWindow
        ?.getSelection()
        ?.toString();
    if (selection) {
      return { content: selection, source: "selection" };
    }

    // Check for focused text field
    try {
      const actor =
        this._window.gBrowser.selectedBrowser?.browsingContext?.currentWindowGlobal?.getActor(
          "AevumixContent"
        );
      if (actor) {
        const result = await actor.sendQuery(
          "Aevumix:GetFocusedFieldContent"
        );
        if (result) {
          return { content: result.text, source: "textfield", ...result };
        }
      }
    } catch (e) {
      // Fallback
    }

    return null;
  }

  /**
   * Show the AI suggestion in a floating panel near the target.
   */
  _showSuggestion(result, action) {
    this._dismissSuggestionPanel();

    const panel = this._document.createElement("panel");
    panel.classList.add("aevumix-suggestion-panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautohide", "true");

    // Header
    const header = this._document.createElement("hbox");
    header.classList.add("aevumix-suggestion-header");
    const title = this._document.createElement("label");
    title.value = this._getActionLabel(action);
    title.classList.add("aevumix-suggestion-title");
    header.appendChild(title);
    panel.appendChild(header);

    // Original text
    if (this._activeTarget?.content) {
      const original = this._document.createElement("description");
      original.classList.add("aevumix-suggestion-original");
      original.textContent = this._activeTarget.content.substring(0, 200);
      panel.appendChild(original);
    }

    // Arrow indicator
    const arrow = this._document.createElement("label");
    arrow.classList.add("aevumix-suggestion-arrow");
    arrow.value = "↓";
    panel.appendChild(arrow);

    // Suggested text
    const suggested = this._document.createElement("description");
    suggested.classList.add("aevumix-suggestion-result");
    suggested.textContent = result.text;
    panel.appendChild(suggested);

    // Action buttons
    const actions = this._document.createElement("hbox");
    actions.classList.add("aevumix-suggestion-actions");

    const applyBtn = this._document.createElement("button");
    applyBtn.setAttribute("label", "Apply");
    applyBtn.classList.add("aevumix-suggestion-apply-btn");
    applyBtn.addEventListener("command", () => {
      this._applySuggestion(result.text);
      this._dismissSuggestionPanel();
    });
    actions.appendChild(applyBtn);

    const copyBtn = this._document.createElement("button");
    copyBtn.setAttribute("label", "Copy");
    copyBtn.addEventListener("command", () => {
      Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Ci.nsIClipboardHelper)
        .copyString(result.text);
    });
    actions.appendChild(copyBtn);

    const dismissBtn = this._document.createElement("button");
    dismissBtn.setAttribute("label", "Dismiss");
    dismissBtn.addEventListener("command", () => {
      this._dismissSuggestionPanel();
    });
    actions.appendChild(dismissBtn);

    panel.appendChild(actions);

    // Add to popup set and show
    const popupSet = this._document.getElementById("mainPopupSet");
    if (popupSet) {
      popupSet.appendChild(panel);
      const anchor = this._window.document.activeElement;
      panel.openPopup(anchor, "after_pointer", 0, 0, false, false);
    }

    this._suggestionPanel = panel;
  }

  /**
   * Apply the suggested text to the target field.
   */
  async _applySuggestion(text) {
    try {
      const actor =
        this._window.gBrowser.selectedBrowser?.browsingContext?.currentWindowGlobal?.getActor(
          "AevumixContent"
        );
      if (actor) {
        await actor.sendQuery("Aevumix:ReplaceText", {
          text,
          source: this._activeTarget?.source,
        });
      }
    } catch (e) {
      console.error("[Aevumix] Failed to apply suggestion:", e);
    }
  }

  /**
   * Dismiss the suggestion panel.
   */
  _dismissSuggestionPanel() {
    if (this._suggestionPanel) {
      this._suggestionPanel.remove();
      this._suggestionPanel = null;
    }
  }

  /**
   * Get a human-readable label for an action type.
   */
  _getActionLabel(action) {
    const labels = {
      improve: "AI Improved Writing",
      grammar: "Grammar & Spelling Fix",
      formal: "Formal Tone",
      casual: "Casual Tone",
      shorter: "Shortened Version",
      longer: "Expanded Version",
      simplify: "Simplified Language",
      continue: "AI Continuation",
      translate: "AI Translation",
    };
    return labels[action] || "AI Suggestion";
  }

  _showProcessingIndicator() {
    // Show a small notification that AI is processing
  }

  _hideProcessingIndicator() {
    // Hide the processing notification
  }

  _showError(message) {
    console.warn("[Aevumix] Writing Assistant:", message);
  }

  /**
   * Enable or disable the writing assistant.
   */
  setEnabled(enabled) {
    this._isEnabled = enabled;
    if (!enabled) {
      this._dismissSuggestionPanel();
    }
  }
}
