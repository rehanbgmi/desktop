/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix AI Engine
 * Core module that manages AI model connections, request routing,
 * and response processing for all Aevumix AI features.
 */

export const AIEngine = {
  _apiKey: null,
  _apiEndpoint: null,
  _defaultModel: "aevumix-default",
  _requestQueue: [],
  _maxConcurrentRequests: 3,
  _activeRequests: 0,
  _timeout: 30000,
  _rateLimitWindow: 60000,
  _requestCount: 0,
  _maxRequestsPerWindow: 60,

  /**
   * Initialize the AI Engine with configuration.
   */
  init() {
    this._loadConfig();
    this._startRateLimitReset();
    console.log("[Aevumix] AI Engine initialized");
  },

  /**
   * Load configuration from preferences.
   */
  _loadConfig() {
    try {
      this._apiKey = Services.prefs.getStringPref(
        "aevumix.ai.api.key",
        ""
      );
      this._apiEndpoint = Services.prefs.getStringPref(
        "aevumix.ai.api.endpoint",
        "https://api.aevumix.app/v1"
      );
      this._defaultModel = Services.prefs.getStringPref(
        "aevumix.ai.model",
        "aevumix-default"
      );
      this._timeout = Services.prefs.getIntPref(
        "aevumix.ai.timeout",
        30000
      );
    } catch (e) {
      // Use defaults
    }
  },

  /**
   * Start the rate limit reset timer.
   */
  _startRateLimitReset() {
    setInterval(() => {
      this._requestCount = 0;
    }, this._rateLimitWindow);
  },

  /**
   * Send a chat message to the AI.
   */
  async chat({ message, model, context, history }) {
    return this._request("chat", {
      message,
      model: model || this._defaultModel,
      context,
      history: history || [],
      system_prompt: this._getSystemPrompt("chat"),
    });
  },

  /**
   * Summarize content.
   */
  async summarize({ content, title, url, mode, maxLength }) {
    return this._request("summarize", {
      content,
      title,
      url,
      mode,
      maxLength,
      system_prompt: this._getSystemPrompt("summarize"),
    });
  },

  /**
   * Get search suggestions.
   */
  async searchSuggestions({ query, context, maxSuggestions }) {
    return this._request("search_suggestions", {
      query,
      context,
      maxSuggestions,
      system_prompt: this._getSystemPrompt("search"),
    });
  },

  /**
   * Get an instant answer to a question.
   */
  async instantAnswer({ query, context }) {
    return this._request("instant_answer", {
      query,
      context,
      system_prompt: this._getSystemPrompt("answer"),
    });
  },

  /**
   * Writing assistance.
   */
  async writingAssist({ text, action, context }) {
    return this._request("writing_assist", {
      text,
      action,
      context,
      system_prompt: this._getSystemPrompt("writing"),
    });
  },

  /**
   * Tab organization.
   */
  async organizeTabs({ tabs, strategy }) {
    return this._request("organize_tabs", {
      tabs,
      strategy,
      system_prompt: this._getSystemPrompt("tabs"),
    });
  },

  /**
   * Tab smart suggestions.
   */
  async tabSuggestions({ tabs }) {
    return this._request("tab_suggestions", {
      tabs,
      system_prompt: this._getSystemPrompt("tabs"),
    });
  },

  /**
   * Detect text language.
   */
  async detectLanguage({ text }) {
    return this._request("detect_language", {
      text,
      system_prompt: this._getSystemPrompt("language"),
    });
  },

  /**
   * Translate text.
   */
  async translate({ text, sourceLanguage, targetLanguage, preserveFormatting }) {
    return this._request("translate", {
      text,
      sourceLanguage,
      targetLanguage,
      preserveFormatting,
      system_prompt: this._getSystemPrompt("translate"),
    });
  },

  /**
   * Core request method with queue management.
   */
  async _request(type, params) {
    // Rate limiting check
    if (this._requestCount >= this._maxRequestsPerWindow) {
      throw new Error("Rate limit exceeded. Please wait before making more requests.");
    }

    // Queue management
    if (this._activeRequests >= this._maxConcurrentRequests) {
      return new Promise((resolve, reject) => {
        this._requestQueue.push({ type, params, resolve, reject });
      });
    }

    this._activeRequests++;
    this._requestCount++;

    try {
      const response = await this._makeRequest(type, params);
      return response;
    } finally {
      this._activeRequests--;
      this._processQueue();
    }
  },

  /**
   * Make the actual HTTP request to the AI API.
   */
  async _makeRequest(type, params) {
    const endpoint = `${this._apiEndpoint}/ai/${type}`;

    const headers = {
      "Content-Type": "application/json",
      "X-Aevumix-Version": "1.0.0",
    };

    if (this._apiKey) {
      headers["Authorization"] = `Bearer ${this._apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this._timeout
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `AI request failed: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    }
  },

  /**
   * Process the next request in the queue.
   */
  _processQueue() {
    if (
      this._requestQueue.length > 0 &&
      this._activeRequests < this._maxConcurrentRequests
    ) {
      const { type, params, resolve, reject } = this._requestQueue.shift();
      this._request(type, params).then(resolve).catch(reject);
    }
  },

  /**
   * Get system prompt for a specific feature.
   */
  _getSystemPrompt(feature) {
    const prompts = {
      chat: `You are Aevumix AI, a helpful and knowledgeable browser assistant. 
             Provide concise, accurate answers. When page context is available, 
             relate your answers to the current page content.`,
      summarize: `You are a content summarizer. Provide clear, accurate summaries 
                  that capture the essential information. Adapt your style to the 
                  requested mode (brief, detailed, bullets, or key points).`,
      search: `You are a search assistant. Provide relevant search suggestions 
               that help users find what they're looking for quickly.`,
      answer: `You are a knowledge assistant. Provide direct, factual answers 
               to questions in a concise format.`,
      writing: `You are a writing assistant. Help improve text while maintaining 
                the author's intent. Be precise with grammar and style suggestions.`,
      tabs: `You are a tab organization assistant. Group related tabs logically 
             and suggest efficient tab management strategies.`,
      language: `You are a language detection system. Identify the primary language 
                 of the given text accurately.`,
      translate: `You are a professional translator. Provide accurate, natural-sounding 
                  translations that preserve meaning, tone, and formatting.`,
    };
    return prompts[feature] || prompts.chat;
  },

  /**
   * Set the API key for authenticated requests.
   */
  setApiKey(key) {
    this._apiKey = key;
    Services.prefs.setStringPref("aevumix.ai.api.key", key);
  },

  /**
   * Set the API endpoint.
   */
  setEndpoint(endpoint) {
    this._apiEndpoint = endpoint;
    Services.prefs.setStringPref("aevumix.ai.api.endpoint", endpoint);
  },

  /**
   * Set the default model.
   */
  setModel(model) {
    this._defaultModel = model;
    Services.prefs.setStringPref("aevumix.ai.model", model);
  },

  /**
   * Get current configuration.
   */
  getConfig() {
    return {
      endpoint: this._apiEndpoint,
      model: this._defaultModel,
      timeout: this._timeout,
      hasApiKey: !!this._apiKey,
    };
  },
};
