/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix AI Smart Search
 * Enhances the URL bar with AI-powered search suggestions, natural language
 * queries, instant answers, and intelligent search refinement.
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AIEngine: "chrome://aevumix/content/AIEngine.sys.mjs",
});

export class AevumixSmartSearch {
  constructor() {
    this._isEnabled = true;
    this._suggestionCache = new Map();
    this._maxCacheSize = 100;
    this._debounceTimer = null;
    this._debounceDelay = 300;
  }

  init(window) {
    this._window = window;
    this._document = window.document;
    this._urlBar = window.gURLBar;
    this._registerListeners();
    console.log("[Aevumix] AI Smart Search initialized");
  }

  /**
   * Register URL bar event listeners for AI suggestions.
   */
  _registerListeners() {
    if (!this._urlBar) return;

    // Listen for input in URL bar
    const inputHandler = this._onInput.bind(this);
    this._urlBar.inputField.addEventListener("input", inputHandler);

    // Listen for focus to show AI suggestions
    this._urlBar.inputField.addEventListener("focus", () => {
      this._showAISuggestions();
    });
  }

  /**
   * Handle URL bar input changes with debouncing.
   */
  _onInput(event) {
    if (!this._isEnabled) return;

    const query = event.target.value.trim();
    if (query.length < 3) {
      this._clearAISuggestions();
      return;
    }

    // Debounce to avoid too many API calls
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._fetchAISuggestions(query);
    }, this._debounceDelay);
  }

  /**
   * Fetch AI-powered search suggestions for the given query.
   */
  async _fetchAISuggestions(query) {
    // Check cache first
    const cacheKey = query.toLowerCase();
    if (this._suggestionCache.has(cacheKey)) {
      this._displaySuggestions(this._suggestionCache.get(cacheKey));
      return;
    }

    try {
      const suggestions = await lazy.AIEngine.searchSuggestions({
        query,
        context: {
          currentUrl: this._window.gBrowser.selectedBrowser?.currentURI?.spec,
          history: this._getRecentSearchHistory(),
        },
        maxSuggestions: 5,
      });

      // Cache results
      this._addToCache(cacheKey, suggestions);
      this._displaySuggestions(suggestions);
    } catch (error) {
      console.error("[Aevumix] Smart Search error:", error);
    }
  }

  /**
   * Display AI suggestions in the URL bar results.
   */
  _displaySuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return;

    // Create AI suggestion result rows for the URL bar
    for (const suggestion of suggestions) {
      this._addSuggestionResult(suggestion);
    }
  }

  /**
   * Add a single suggestion result to the URL bar dropdown.
   */
  _addSuggestionResult(suggestion) {
    const heuristicResult = {
      type: "aevumix-ai-suggestion",
      icon: "chrome://aevumix/content/icons/ai-spark.svg",
      title: suggestion.title,
      description: suggestion.description,
      action: {
        type: "search",
        params: { query: suggestion.query || suggestion.title },
      },
    };

    // Integrate with URL bar results via custom view
    this._insertAIResult(heuristicResult);
  }

  /**
   * Insert an AI result into the URL bar's result list.
   */
  _insertAIResult(result) {
    // Use the URL bar's view to add custom results
    const view = this._urlBar?.view;
    if (view && view.addResult) {
      view.addResult(result);
    }
  }

  /**
   * Show AI suggestions panel when URL bar is focused.
   */
  _showAISuggestions() {
    if (!this._isEnabled) return;

    const query = this._urlBar?.inputField?.value?.trim();
    if (query && query.length >= 3) {
      this._fetchAISuggestions(query);
    }
  }

  /**
   * Clear AI suggestions from the URL bar.
   */
  _clearAISuggestions() {
    const view = this._urlBar?.view;
    if (view && view.removeResultsByType) {
      view.removeResultsByType("aevumix-ai-suggestion");
    }
  }

  /**
   * Get recent search history for context.
   */
  _getRecentSearchHistory() {
    try {
      const history = Services.prefs.getStringPref(
        "aevumix.ai.search.history",
        "[]"
      );
      return JSON.parse(history).slice(-10);
    } catch (e) {
      return [];
    }
  }

  /**
   * Add suggestions to cache with LRU eviction.
   */
  _addToCache(key, suggestions) {
    if (this._suggestionCache.size >= this._maxCacheSize) {
      // Remove oldest entry
      const firstKey = this._suggestionCache.keys().next().value;
      this._suggestionCache.delete(firstKey);
    }
    this._suggestionCache.set(key, suggestions);
  }

  /**
   * Handle natural language query - detect if user is asking a question.
   */
  isNaturalLanguageQuery(query) {
    const questionPatterns = [
      /^(what|who|where|when|why|how|which|can|could|should|would|is|are|do|does|did)/i,
      /\?$/,
      /^(tell me|explain|define|describe|show me|find)/i,
    ];
    return questionPatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Process a natural language query and return an instant answer.
   */
  async getInstantAnswer(query) {
    if (!this.isNaturalLanguageQuery(query)) return null;

    try {
      const answer = await lazy.AIEngine.instantAnswer({
        query,
        context: {
          currentUrl: this._window.gBrowser.selectedBrowser?.currentURI?.spec,
        },
      });
      return answer;
    } catch (error) {
      console.error("[Aevumix] Instant answer error:", error);
      return null;
    }
  }

  /**
   * Enable or disable the smart search feature.
   */
  setEnabled(enabled) {
    this._isEnabled = enabled;
    if (!enabled) {
      this._clearAISuggestions();
    }
  }

  /**
   * Clear the suggestion cache.
   */
  clearCache() {
    this._suggestionCache.clear();
  }
}
