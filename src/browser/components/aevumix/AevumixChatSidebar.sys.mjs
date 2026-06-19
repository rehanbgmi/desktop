/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix AI Chat Sidebar
 * Provides an AI-powered chat assistant integrated into the browser sidebar.
 * Features: contextual page Q&A, general knowledge, code assistance,
 * writing help, and conversation history.
 */

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AIEngine: "chrome://aevumix/content/AIEngine.sys.mjs",
});

export class AevumixChatSidebar {
  static SIDEBAR_ID = "aevumix-chat-sidebar";
  static PANEL_ID = "aevumix-chat-panel";

  constructor() {
    this._conversationHistory = [];
    this._maxHistoryLength = 50;
    this._currentModel = "aevumix-default";
    this._isProcessing = false;
  }

  /**
   * Initialize the chat sidebar and register event listeners.
   */
  init(window) {
    this._window = window;
    this._document = window.document;
    this._createSidebarUI();
    this._registerEventListeners();
    this._loadConversationHistory();
    console.log("[Aevumix] AI Chat Sidebar initialized");
  }

  /**
   * Create the sidebar UI elements.
   */
  _createSidebarUI() {
    const sidebar = this._document.createElement("vbox");
    sidebar.id = AevumixChatSidebar.PANEL_ID;
    sidebar.setAttribute("flex", "1");
    sidebar.classList.add("aevumix-chat-container");

    // Header
    const header = this._createHeader();
    sidebar.appendChild(header);

    // Chat messages area
    const messagesArea = this._createMessagesArea();
    sidebar.appendChild(messagesArea);

    // Input area
    const inputArea = this._createInputArea();
    sidebar.appendChild(inputArea);

    this._sidebarElement = sidebar;
  }

  /**
   * Create the header with model selector and controls.
   */
  _createHeader() {
    const header = this._document.createElement("hbox");
    header.classList.add("aevumix-chat-header");

    // Title
    const title = this._document.createElement("label");
    title.value = "Aevumix AI";
    title.classList.add("aevumix-chat-title");
    header.appendChild(title);

    // Model selector
    const modelSelector = this._document.createElement("menulist");
    modelSelector.classList.add("aevumix-model-selector");
    const modelPopup = this._document.createElement("menupopup");

    const models = [
      { label: "Aevumix Default", value: "aevumix-default" },
      { label: "Aevumix Fast", value: "aevumix-fast" },
      { label: "Aevumix Creative", value: "aevumix-creative" },
      { label: "Aevumix Code", value: "aevumix-code" },
    ];

    for (const model of models) {
      const item = this._document.createElement("menuitem");
      item.setAttribute("label", model.label);
      item.setAttribute("value", model.value);
      modelPopup.appendChild(item);
    }

    modelSelector.appendChild(modelPopup);
    modelSelector.value = this._currentModel;
    modelSelector.addEventListener("command", (e) => {
      this._currentModel = e.target.value;
    });
    header.appendChild(modelSelector);

    // Clear conversation button
    const clearBtn = this._document.createElement("toolbarbutton");
    clearBtn.classList.add("aevumix-chat-clear-btn");
    clearBtn.setAttribute("tooltiptext", "Clear conversation");
    clearBtn.addEventListener("command", () => this.clearConversation());
    header.appendChild(clearBtn);

    return header;
  }

  /**
   * Create the scrollable messages area.
   */
  _createMessagesArea() {
    const scrollbox = this._document.createElement("scrollbox");
    scrollbox.classList.add("aevumix-chat-messages");
    scrollbox.setAttribute("orient", "vertical");
    scrollbox.setAttribute("flex", "1");
    this._messagesArea = scrollbox;
    return scrollbox;
  }

  /**
   * Create the input area with text field and send button.
   */
  _createInputArea() {
    const container = this._document.createElement("vbox");
    container.classList.add("aevumix-chat-input-container");

    // Context indicator
    const contextBar = this._document.createElement("hbox");
    contextBar.classList.add("aevumix-context-bar");
    const contextIcon = this._document.createElement("image");
    contextIcon.classList.add("aevumix-context-icon");
    contextBar.appendChild(contextIcon);
    const contextLabel = this._document.createElement("label");
    contextLabel.classList.add("aevumix-context-label");
    contextLabel.value = "Page context active";
    contextBar.appendChild(contextLabel);
    this._contextBar = contextBar;
    container.appendChild(contextBar);

    // Input row
    const inputRow = this._document.createElement("hbox");
    inputRow.classList.add("aevumix-chat-input-row");

    const textInput = this._document.createElement("textbox");
    textInput.classList.add("aevumix-chat-input");
    textInput.setAttribute("placeholder", "Ask Aevumix AI anything...");
    textInput.setAttribute("multiline", "true");
    textInput.setAttribute("rows", "3");
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });
    this._textInput = textInput;
    inputRow.appendChild(textInput);

    const sendBtn = this._document.createElement("toolbarbutton");
    sendBtn.classList.add("aevumix-chat-send-btn");
    sendBtn.setAttribute("tooltiptext", "Send message");
    sendBtn.addEventListener("command", () => this._sendMessage());
    inputRow.appendChild(sendBtn);

    container.appendChild(inputRow);

    // Quick actions
    const quickActions = this._createQuickActions();
    container.appendChild(quickActions);

    return container;
  }

  /**
   * Create quick action buttons for common AI tasks.
   */
  _createQuickActions() {
    const container = this._document.createElement("hbox");
    container.classList.add("aevumix-quick-actions");

    const actions = [
      { label: "Summarize", prompt: "Summarize this page for me" },
      { label: "Explain", prompt: "Explain the main topic of this page" },
      { label: "Key Points", prompt: "List the key points from this page" },
      { label: "Translate", prompt: "Translate this page content to English" },
    ];

    for (const action of actions) {
      const btn = this._document.createElement("toolbarbutton");
      btn.classList.add("aevumix-quick-action-btn");
      btn.setAttribute("label", action.label);
      btn.addEventListener("command", () => {
        this._textInput.value = action.prompt;
        this._sendMessage();
      });
      container.appendChild(btn);
    }

    return container;
  }

  /**
   * Register event listeners for sidebar events.
   */
  _registerEventListeners() {
    // Listen for page load to update context
    this._window.gBrowser.addTabsProgressListener({
      onLocationChange: () => this._updatePageContext(),
    });

    // Listen for tab selection changes
    this._window.gBrowser.tabContainer.addEventListener("TabSelect", () => {
      this._updatePageContext();
    });
  }

  /**
   * Send a message to the AI engine and display the response.
   */
  async _sendMessage() {
    const message = this._textInput.value.trim();
    if (!message || this._isProcessing) return;

    this._isProcessing = true;
    this._textInput.value = "";

    // Add user message to UI
    this._addMessageToUI("user", message);

    // Add to history
    this._conversationHistory.push({
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    // Show typing indicator
    const typingIndicator = this._showTypingIndicator();

    try {
      // Get page context if available
      const pageContext = await this._getPageContext();

      // Send to AI engine
      const response = await lazy.AIEngine.chat({
        message,
        model: this._currentModel,
        context: pageContext,
        history: this._conversationHistory.slice(-this._maxHistoryLength),
      });

      // Remove typing indicator
      typingIndicator.remove();

      // Add AI response to UI
      this._addMessageToUI("assistant", response.content);

      // Add to history
      this._conversationHistory.push({
        role: "assistant",
        content: response.content,
        timestamp: Date.now(),
      });

      // Save conversation
      this._saveConversationHistory();
    } catch (error) {
      typingIndicator.remove();
      this._addMessageToUI(
        "error",
        "Sorry, I encountered an error. Please try again."
      );
      console.error("[Aevumix] Chat error:", error);
    } finally {
      this._isProcessing = false;
    }
  }

  /**
   * Add a message element to the chat UI.
   */
  _addMessageToUI(role, content) {
    const messageEl = this._document.createElement("vbox");
    messageEl.classList.add("aevumix-chat-message", `aevumix-message-${role}`);

    // Avatar
    const avatar = this._document.createElement("image");
    avatar.classList.add("aevumix-message-avatar", `aevumix-avatar-${role}`);
    messageEl.appendChild(avatar);

    // Content
    const contentEl = this._document.createElement("description");
    contentEl.classList.add("aevumix-message-content");
    contentEl.textContent = content;

    // Make links clickable
    this._linkifyContent(contentEl);

    messageEl.appendChild(contentEl);

    // Timestamp
    const timestamp = this._document.createElement("label");
    timestamp.classList.add("aevumix-message-timestamp");
    timestamp.value = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    messageEl.appendChild(timestamp);

    this._messagesArea.appendChild(messageEl);
    this._messagesArea.scrollTop = this._messagesArea.scrollHeight;
  }

  /**
   * Show a typing indicator in the chat.
   */
  _showTypingIndicator() {
    const indicator = this._document.createElement("hbox");
    indicator.classList.add("aevumix-typing-indicator");

    for (let i = 0; i < 3; i++) {
      const dot = this._document.createElement("div");
      dot.classList.add("aevumix-typing-dot");
      dot.style.animationDelay = `${i * 0.2}s`;
      indicator.appendChild(dot);
    }

    this._messagesArea.appendChild(indicator);
    this._messagesArea.scrollTop = this._messagesArea.scrollHeight;
    return indicator;
  }

  /**
   * Get the current page content as context for the AI.
   */
  async _getPageContext() {
    try {
      const browser = this._window.gBrowser.selectedBrowser;
      if (!browser || !browser.currentURI) return null;

      const url = browser.currentURI.spec;
      const title = browser.contentTitle || "";

      // Only include context for http/https pages
      if (!url.startsWith("http")) return null;

      return {
        url,
        title,
        // Page text content would be extracted via content script
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Update the page context indicator.
   */
  _updatePageContext() {
    const browser = this._window.gBrowser?.selectedBrowser;
    if (browser?.currentURI?.spec?.startsWith("http")) {
      this._contextBar.hidden = false;
      this._contextBar.querySelector(".aevumix-context-label").value =
        `Context: ${browser.contentTitle || "Current page"}`;
    } else {
      this._contextBar.hidden = true;
    }
  }

  /**
   * Make URLs in content clickable.
   */
  _linkifyContent(element) {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const html = element.innerHTML;
    element.innerHTML = html.replace(
      urlRegex,
      '<a href="$1" class="aevumix-chat-link">$1</a>'
    );
  }

  /**
   * Clear the conversation history.
   */
  clearConversation() {
    this._conversationHistory = [];
    while (this._messagesArea.firstChild) {
      this._messagesArea.firstChild.remove();
    }
    this._saveConversationHistory();
  }

  /**
   * Save conversation history to local storage.
   */
  _saveConversationHistory() {
    try {
      const data = JSON.stringify(this._conversationHistory);
      // Store in browser preferences
      Services.prefs.setStringPref("aevumix.ai.chat.history", data);
    } catch (e) {
      console.error("[Aevumix] Failed to save chat history:", e);
    }
  }

  /**
   * Load conversation history from local storage.
   */
  _loadConversationHistory() {
    try {
      const data = Services.prefs.getStringPref(
        "aevumix.ai.chat.history",
        "[]"
      );
      this._conversationHistory = JSON.parse(data);
      // Replay messages to UI
      for (const msg of this._conversationHistory) {
        this._addMessageToUI(msg.role, msg.content);
      }
    } catch (e) {
      this._conversationHistory = [];
    }
  }
}
