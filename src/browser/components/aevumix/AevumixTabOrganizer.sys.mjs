/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Aevumix AI Tab Organizer
 * Intelligently groups, sorts, and manages browser tabs using AI.
 * Features: auto-grouping by topic, smart tab suggestions, duplicate
 * detection, memory optimization, and tab activity prediction.
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AIEngine: "chrome://aevumix/content/AIEngine.sys.mjs",
});

export class AevumixTabOrganizer {
  constructor() {
    this._isEnabled = true;
    this._groups = new Map();
    this._autoOrganize = false;
    this._organizeTimer = null;
    this._organizeInterval = 60000; // 1 minute
  }

  init(window) {
    this._window = window;
    this._document = window.document;
    this._tabContainer = window.gBrowser.tabContainer;
    this._registerListeners();
    this._registerToolbarButton();
    console.log("[Aevumix] AI Tab Organizer initialized");
  }

  /**
   * Register tab-related event listeners.
   */
  _registerListeners() {
    this._tabContainer.addEventListener("TabOpen", () => {
      if (this._autoOrganize) {
        this._scheduleOrganize();
      }
    });

    this._tabContainer.addEventListener("TabClose", () => {
      this._updateGroups();
    });

    this._tabContainer.addEventListener("TabAttrModified", () => {
      this._updateGroups();
    });
  }

  /**
   * Register a toolbar button for manual tab organization.
   */
  _registerToolbarButton() {
    const button = this._document.getElementById("aevumix-organize-tabs-btn");
    if (button) {
      button.addEventListener("command", () => {
        this.organizeTabs();
      });
    }
  }

  /**
   * Organize all open tabs using AI grouping.
   */
  async organizeTabs() {
    if (!this._isEnabled) return;

    const tabs = this._getTabData();
    if (tabs.length < 3) return; // Not enough tabs to organize

    try {
      const groups = await lazy.AIEngine.organizeTabs({
        tabs: tabs.map((t) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          domain: t.domain,
          lastAccessed: t.lastAccessed,
          pinned: t.pinned,
        })),
        strategy: "topic", // Group by topic/domain
      });

      this._applyGroups(groups);
      this._showOrganizationResult(groups);
    } catch (error) {
      console.error("[Aevumix] Tab organization failed:", error);
    }
  }

  /**
   * Get data for all open tabs.
   */
  _getTabData() {
    const tabs = [];
    const browser = this._window.gBrowser;

    for (const tab of browser.tabs) {
      tabs.push({
        id: tab.getAttribute("linkedpanel"),
        title: tab.label || "Untitled",
        url: tab.linkedBrowser?.currentURI?.spec || "",
        domain: this._extractDomain(
          tab.linkedBrowser?.currentURI?.spec || ""
        ),
        lastAccessed: tab.lastAccessed || 0,
        pinned: tab.pinned,
        muted: tab.muted,
        busy: tab.busy,
      });
    }

    return tabs;
  }

  /**
   * Extract domain from URL.
   */
  _extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return "";
    }
  }

  /**
   * Apply AI-generated groups to the tab bar.
   */
  _applyGroups(groups) {
    this._groups.clear();
    const browser = this._window.gBrowser;

    for (const group of groups) {
      this._groups.set(group.name, group.tabIds);

      // Apply visual grouping via CSS classes
      for (const tabId of group.tabIds) {
        const tab = this._findTabById(tabId);
        if (tab) {
          tab.setAttribute("aevumix-group", group.name);
          tab.classList.add("aevumix-grouped-tab");
        }
      }
    }

    // Save groups to preferences
    this._saveGroups();
  }

  /**
   * Find a tab by its ID.
   */
  _findTabById(id) {
    for (const tab of this._window.gBrowser.tabs) {
      if (tab.getAttribute("linkedpanel") === id) {
        return tab;
      }
    }
    return null;
  }

  /**
   * Show the organization result to the user.
   */
  _showOrganizationResult(groups) {
    const totalGroups = groups.length;
    const totalTabs = groups.reduce((sum, g) => sum + g.tabIds.length, 0);

    // Show notification
    const notificationBox = this._window.gBrowser.getNotificationBox();
    notificationBox.appendNotification("aevumix-tabs-organized", {
      label: `Aevumix organized ${totalTabs} tabs into ${totalGroups} groups`,
      priority: notificationBox.PRIORITY_INFO_LOW,
      duration: 5000,
    });
  }

  /**
   * Detect duplicate tabs and offer to close them.
   */
  async detectDuplicates() {
    const tabs = this._getTabData();
    const duplicates = new Map();

    for (let i = 0; i < tabs.length; i++) {
      for (let j = i + 1; j < tabs.length; j++) {
        if (this._areDuplicates(tabs[i], tabs[j])) {
          if (!duplicates.has(tabs[i].url)) {
            duplicates.set(tabs[i].url, [tabs[i]]);
          }
          duplicates.get(tabs[i].url).push(tabs[j]);
        }
      }
    }

    if (duplicates.size > 0) {
      this._showDuplicatePrompt(duplicates);
    }

    return duplicates;
  }

  /**
   * Check if two tabs are duplicates.
   */
  _areDuplicates(tabA, tabB) {
    // Exact URL match
    if (tabA.url === tabB.url) return true;

    // Same domain + similar title (fuzzy matching)
    if (
      tabA.domain === tabB.domain &&
      this._similarTitles(tabA.title, tabB.title)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Simple title similarity check.
   */
  _similarTitles(a, b) {
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalize(a) === normalize(b);
  }

  /**
   * Show a prompt to close duplicate tabs.
   */
  _showDuplicatePrompt(duplicates) {
    const count = Array.from(duplicates.values()).reduce(
      (sum, tabs) => sum + tabs.length - 1,
      0
    );

    const notificationBox = this._window.gBrowser.getNotificationBox();
    const notification = notificationBox.appendNotification(
      "aevumix-duplicates-found",
      {
        label: `Found ${count} duplicate tabs`,
        priority: notificationBox.PRIORITY_WARNING_MEDIUM,
        buttons: [
          {
            label: "Close Duplicates",
            callback: () => {
              this._closeDuplicates(duplicates);
            },
          },
          {
            label: "Dismiss",
            callback: () => {},
          },
        ],
      }
    );
  }

  /**
   * Close duplicate tabs, keeping the most recently accessed one.
   */
  _closeDuplicates(duplicates) {
    const browser = this._window.gBrowser;

    for (const [, tabs] of duplicates) {
      // Sort by last accessed, keep the most recent
      tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
      for (let i = 1; i < tabs.length; i++) {
        const tab = this._findTabById(tabs[i].id);
        if (tab) {
          browser.removeTab(tab);
        }
      }
    }
  }

  /**
   * Get AI suggestions for tab management (close old, mute, etc.).
   */
  async getSmartSuggestions() {
    const tabs = this._getTabData();

    try {
      const suggestions = await lazy.AIEngine.tabSuggestions({
        tabs: tabs.map((t) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          lastAccessed: t.lastAccessed,
          pinned: t.pinned,
        })),
      });
      return suggestions;
    } catch (error) {
      console.error("[Aevumix] Smart tab suggestions failed:", error);
      return [];
    }
  }

  /**
   * Schedule auto-organization with debounce.
   */
  _scheduleOrganize() {
    clearTimeout(this._organizeTimer);
    this._organizeTimer = setTimeout(() => {
      this.organizeTabs();
    }, this._organizeInterval);
  }

  /**
   * Update groups after tab changes.
   */
  _updateGroups() {
    // Remove groups for closed tabs
    for (const [groupName, tabIds] of this._groups) {
      const validIds = tabIds.filter((id) => this._findTabById(id));
      if (validIds.length === 0) {
        this._groups.delete(groupName);
      } else {
        this._groups.set(groupName, validIds);
      }
    }
    this._saveGroups();
  }

  /**
   * Save groups to preferences.
   */
  _saveGroups() {
    try {
      const data = JSON.stringify(
        Object.fromEntries(this._groups)
      );
      Services.prefs.setStringPref("aevumix.ai.tab.groups", data);
    } catch (e) {
      console.error("[Aevumix] Failed to save tab groups:", e);
    }
  }

  /**
   * Load groups from preferences.
   */
  _loadGroups() {
    try {
      const data = Services.prefs.getStringPref(
        "aevumix.ai.tab.groups",
        "{}"
      );
      const obj = JSON.parse(data);
      this._groups = new Map(Object.entries(obj));
    } catch (e) {
      this._groups = new Map();
    }
  }

  /**
   * Enable or disable auto-organization.
   */
  setAutoOrganize(enabled) {
    this._autoOrganize = enabled;
    if (enabled) {
      this._scheduleOrganize();
    } else {
      clearTimeout(this._organizeTimer);
    }
  }

  /**
   * Enable or disable the tab organizer.
   */
  setEnabled(enabled) {
    this._isEnabled = enabled;
    if (!enabled) {
      this.setAutoOrganize(false);
      // Remove visual grouping
      for (const tab of this._window.gBrowser.tabs) {
        tab.removeAttribute("aevumix-group");
        tab.classList.remove("aevumix-grouped-tab");
      }
    }
  }
}
