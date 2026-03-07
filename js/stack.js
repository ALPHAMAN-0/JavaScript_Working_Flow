/**
 * Call Stack Module
 * Manages the call stack data structure for the JS engine simulation.
 */
window.JSDebugger = window.JSDebugger || {};

(function (ns) {
  'use strict';

  class CallStack {
    constructor() {
      this._frames = [];
      this._colorIndex = 0;
    }

    push(frame) {
      const entry = {
        id: Date.now() + Math.random(),
        label: frame.label || 'anonymous()',
        line: frame.line ?? null,
        colorClass: frame.label === 'main()' ? 'color-main' : 'color-' + (this._colorIndex++ % 5),
        timestamp: Date.now()
      };
      this._frames.push(entry);
      return entry;
    }

    pop() {
      if (this._frames.length === 0) return null;
      return this._frames.pop();
    }

    peek() {
      if (this._frames.length === 0) return null;
      return this._frames[this._frames.length - 1];
    }

    isEmpty() {
      return this._frames.length === 0;
    }

    size() {
      return this._frames.length;
    }

    frames() {
      return [...this._frames];
    }

    clear() {
      this._frames = [];
      this._colorIndex = 0;
    }
  }

  ns.CallStack = CallStack;
})(window.JSDebugger);
