/**
 * Queue Module
 * Manages Callback Queue, Microtask Queue, and Web APIs registry.
 */
window.JSDebugger = window.JSDebugger || {};

(function (ns) {
  'use strict';

  /** Simple FIFO queue */
  class Queue {
    constructor() {
      this._items = [];
    }

    enqueue(item) {
      const entry = {
        id: Date.now() + Math.random(),
        label: item.label || 'callback()',
        body: item.body || [],
        timestamp: Date.now()
      };
      this._items.push(entry);
      return entry;
    }

    dequeue() {
      return this._items.shift() || null;
    }

    peek() {
      return this._items[0] || null;
    }

    isEmpty() {
      return this._items.length === 0;
    }

    size() {
      return this._items.length;
    }

    items() {
      return [...this._items];
    }

    clear() {
      this._items = [];
    }
  }

  /** Web APIs registry — tracks timers, fetch, etc. */
  class WebAPIs {
    constructor() {
      this._entries = [];
    }

    register(entry) {
      const item = {
        id: Date.now() + Math.random(),
        label: entry.label || 'Timer',
        type: entry.type || 'timer',
        delay: entry.delay ?? 0,
        callback: entry.callback || { label: 'callback()', body: [] },
        timestamp: Date.now()
      };
      this._entries.push(item);
      return item;
    }

    complete(id) {
      const idx = this._entries.findIndex(e => e.id === id);
      if (idx === -1) return null;
      return this._entries.splice(idx, 1)[0];
    }

    completeFirst() {
      return this._entries.shift() || null;
    }

    isEmpty() {
      return this._entries.length === 0;
    }

    size() {
      return this._entries.length;
    }

    entries() {
      return [...this._entries];
    }

    clear() {
      this._entries = [];
    }
  }

  ns.CallbackQueue = Queue;
  ns.MicrotaskQueue = Queue;
  ns.WebAPIs = WebAPIs;
})(window.JSDebugger);
