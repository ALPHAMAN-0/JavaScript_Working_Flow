/**
 * Engine Module
 * Parses JavaScript code and generates step-by-step simulation events.
 * Supports: function declarations/calls, console.log, setTimeout,
 *           Promise, async/await.
 */
window.JSDebugger = window.JSDebugger || {};

(function (ns) {
  'use strict';

  /* ============================
     Step types used by the engine
     ============================ */
  const StepType = {
    PUSH_STACK: 'push_stack',
    POP_STACK: 'pop_stack',
    REGISTER_WEBAPI: 'register_webapi',
    WEBAPI_COMPLETE: 'webapi_complete',
    ENQUEUE_CALLBACK: 'enqueue_callback',
    ENQUEUE_MICROTASK: 'enqueue_microtask',
    EVENT_LOOP_CHECK: 'event_loop_check',
    DEQUEUE_CALLBACK: 'dequeue_callback',
    DEQUEUE_MICROTASK: 'dequeue_microtask',
    LOG: 'log',
    HIGHLIGHT_LINE: 'highlight_line'
  };

  /* ============================
     Example code snippets
     ============================ */
  const EXAMPLES = {
    sync: `function first() {
  second();
}

function second() {
  third();
}

function third() {
  console.log("Hello");
}

first();`,

    'async-timeout': `console.log("Start");

setTimeout(() => {
  console.log("Timeout");
}, 0);

console.log("End");`,

    promise: `console.log("Start");

Promise.resolve().then(() => {
  console.log("Promise 1");
}).then(() => {
  console.log("Promise 2");
});

console.log("End");`,

    'async-await': `async function fetchData() {
  console.log("Fetching...");
  const data = await getAPI();
  console.log("Got: " + data);
}

function getAPI() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("data");
    }, 1000);
  });
}

console.log("Before");
fetchData();
console.log("After");`,

    mixed: `console.log("Script start");

setTimeout(() => {
  console.log("setTimeout 1");
}, 0);

Promise.resolve().then(() => {
  console.log("Promise 1");
}).then(() => {
  console.log("Promise 2");
});

setTimeout(() => {
  console.log("setTimeout 2");
}, 0);

console.log("Script end");`
  };

  /* ============================
     Simple Parser
     ============================ */
  class Parser {
    parse(code) {
      this.code = code;
      this.lines = code.split('\n');
      this.functions = new Map();
      this.topLevel = [];

      this._extractFunctions();
      this._extractTopLevel();

      return {
        functions: this.functions,
        topLevel: this.topLevel
      };
    }

    /** Extract function declarations and their parsed bodies */
    _extractFunctions() {
      const code = this.code;
      // Match function declarations: [async] function name(...) { ... }
      const funcRegex = /(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
      let match;

      while ((match = funcRegex.exec(code)) !== null) {
        const isAsync = !!match[1];
        const name = match[2];
        const params = match[3].trim();
        const bodyStart = match.index + match[0].length;
        const bodyEnd = this._findMatchingBrace(code, bodyStart - 1);
        const bodyCode = code.substring(bodyStart, bodyEnd).trim();
        const startLine = this._getLineNumber(match.index);
        const endLine = this._getLineNumber(bodyEnd);

        const bodyStatements = this._parseStatements(bodyCode, startLine + 1);

        this.functions.set(name, {
          name,
          isAsync,
          params,
          bodyCode,
          body: bodyStatements,
          startLine,
          endLine
        });
      }
    }

    /** Extract top-level statements (not inside function declarations) */
    _extractTopLevel() {
      const code = this.code;
      const lines = this.lines;
      let i = 0;

      // Build a set of line ranges covered by function declarations
      const funcRanges = [];
      for (const func of this.functions.values()) {
        funcRanges.push({ start: func.startLine, end: func.endLine });
      }

      const topLevelLines = [];
      let currentStatement = '';
      let braceDepth = 0;
      let parenDepth = 0;
      let inString = false;
      let stringChar = '';
      let stmtStartLine = -1;

      for (i = 0; i < lines.length; i++) {
        // Skip lines inside function declarations
        if (funcRanges.some(r => i >= r.start && i <= r.end)) continue;

        const line = lines[i].trim();
        if (!line) continue;

        if (stmtStartLine === -1) stmtStartLine = i;
        currentStatement += (currentStatement ? '\n' : '') + lines[i];

        // Track braces/parens to detect multi-line statements
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (inString) {
            if (ch === stringChar && line[c - 1] !== '\\') inString = false;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === '`') {
            inString = true;
            stringChar = ch;
          } else if (ch === '(') parenDepth++;
          else if (ch === ')') parenDepth--;
          else if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }

        // Statement is complete when braces and parens are balanced
        if (braceDepth <= 0 && parenDepth <= 0) {
          const trimmed = currentStatement.trim();
          if (trimmed) {
            const parsed = this._parseSingleStatement(trimmed, stmtStartLine);
            if (parsed) this.topLevel.push(parsed);
          }
          currentStatement = '';
          braceDepth = 0;
          parenDepth = 0;
          stmtStartLine = -1;
        }
      }

      // Handle any remaining statement
      if (currentStatement.trim()) {
        const parsed = this._parseSingleStatement(currentStatement.trim(), stmtStartLine);
        if (parsed) this.topLevel.push(parsed);
      }
    }

    /** Parse a block of code into individual statements */
    _parseStatements(code, lineOffset) {
      const statements = [];
      const lines = code.split('\n');
      let currentStatement = '';
      let braceDepth = 0;
      let parenDepth = 0;
      let inString = false;
      let stringChar = '';
      let stmtStartLine = lineOffset;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (!currentStatement) stmtStartLine = lineOffset + i;
        currentStatement += (currentStatement ? '\n' : '') + lines[i];

        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (inString) {
            if (ch === stringChar && line[c - 1] !== '\\') inString = false;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === '`') {
            inString = true;
            stringChar = ch;
          } else if (ch === '(') parenDepth++;
          else if (ch === ')') parenDepth--;
          else if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }

        if (braceDepth <= 0 && parenDepth <= 0) {
          const trimmed = currentStatement.trim();
          if (trimmed) {
            const parsed = this._parseSingleStatement(trimmed, stmtStartLine);
            if (parsed) statements.push(parsed);
          }
          currentStatement = '';
          braceDepth = 0;
          parenDepth = 0;
        }
      }

      if (currentStatement.trim()) {
        const parsed = this._parseSingleStatement(currentStatement.trim(), stmtStartLine);
        if (parsed) statements.push(parsed);
      }

      return statements;
    }

    /** Classify a single statement */
    _parseSingleStatement(stmt, line) {
      stmt = stmt.replace(/;+\s*$/, '').trim();
      if (!stmt) return null;

      // console.log(...)
      let m = stmt.match(/^console\.log\s*\(([\s\S]*)\)$/);
      if (m) {
        return { type: 'console_log', args: m[1].trim(), line, raw: stmt };
      }

      // setTimeout(() => { ... }, delay) or setTimeout(function() { ... }, delay)
      m = stmt.match(/^setTimeout\s*\(\s*([\s\S]*)\)$/);
      if (m) {
        const inner = m[1];
        const cbResult = this._extractCallbackAndDelay(inner);
        return {
          type: 'set_timeout',
          delay: cbResult.delay,
          callback: {
            label: 'setTimeout callback',
            body: this._parseStatements(cbResult.bodyCode, line + 1)
          },
          line,
          raw: stmt
        };
      }

      // Promise.resolve().then(...).then(...)
      if (stmt.match(/^Promise\.resolve\s*\(\s*\)/)) {
        const thenChain = this._extractThenChain(stmt, line);
        return { type: 'promise_chain', thens: thenChain, line, raw: stmt };
      }

      // new Promise((resolve) => { ... })
      m = stmt.match(/^(?:(?:const|let|var)\s+(\w+)\s*=\s*)?new\s+Promise\s*\(\s*([\s\S]*)\)$/);
      if (m) {
        const varName = m[1] || null;
        const inner = m[2];
        const cbBody = this._extractArrowOrFuncBody(inner);
        return {
          type: 'new_promise',
          varName,
          callback: {
            label: 'Promise executor',
            body: this._parseStatements(cbBody, line + 1)
          },
          line,
          raw: stmt
        };
      }

      // return new Promise(...) or return someValue
      m = stmt.match(/^return\s+([\s\S]+)$/);
      if (m) {
        const inner = m[1].trim();
        const innerParsed = this._parseSingleStatement(inner, line);
        return { type: 'return', value: innerParsed || { type: 'expression', raw: inner, line }, line, raw: stmt };
      }

      // await expression
      m = stmt.match(/^(?:(?:const|let|var)\s+(\w+)\s*=\s*)?await\s+([\s\S]+)$/);
      if (m) {
        const varName = m[1] || null;
        const expr = m[2].trim();
        const exprParsed = this._parseSingleStatement(expr, line);
        return {
          type: 'await',
          varName,
          expression: exprParsed || { type: 'expression', raw: expr, line },
          line,
          raw: stmt
        };
      }

      // Variable declaration with function call: const x = funcName(...)
      m = stmt.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\s*\(([\s\S]*)\)\s*$/);
      if (m && !['setTimeout', 'setInterval', 'Promise', 'new'].includes(m[2])) {
        return { type: 'function_call', name: m[2], args: m[3], varName: m[1], line, raw: stmt };
      }

      // Simple function call: name(args)
      m = stmt.match(/^(\w+)\s*\(([\s\S]*)\)\s*$/);
      if (m && !['if', 'for', 'while', 'switch', 'function', 'async'].includes(m[1])) {
        return { type: 'function_call', name: m[1], args: m[2], line, raw: stmt };
      }

      // Method call on variable: resolve("data"), reject("err")
      m = stmt.match(/^(resolve|reject)\s*\(([\s\S]*)\)\s*$/);
      if (m) {
        return { type: 'resolve_reject', which: m[1], args: m[2].trim(), line, raw: stmt };
      }

      // Generic expression (variable declarations, etc.)
      return { type: 'expression', raw: stmt, line };
    }

    /** Extract callback body and delay from setTimeout inner content */
    _extractCallbackAndDelay(inner) {
      // Find the last comma at depth 0 to separate callback from delay
      let depth = 0;
      let inStr = false;
      let strCh = '';
      let lastCommaIdx = -1;

      for (let i = inner.length - 1; i >= 0; i--) {
        const ch = inner[i];
        if (inStr) {
          if (ch === strCh && inner[i - 1] !== '\\') inStr = false;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; }
        else if (ch === ')' || ch === '}' || ch === ']') depth++;
        else if (ch === '(' || ch === '{' || ch === '[') depth--;
        else if (ch === ',' && depth === 0) { lastCommaIdx = i; break; }
      }

      let delay = 0;
      let cbPart = inner;
      if (lastCommaIdx !== -1) {
        cbPart = inner.substring(0, lastCommaIdx).trim();
        const delayStr = inner.substring(lastCommaIdx + 1).trim();
        delay = parseInt(delayStr, 10) || 0;
      }

      const bodyCode = this._extractArrowOrFuncBody(cbPart);
      return { bodyCode, delay };
    }

    /** Extract the body code from an arrow function or function expression */
    _extractArrowOrFuncBody(code) {
      code = code.trim();

      // Arrow: (...) => { body } or param => { body }
      let m = code.match(/^(?:\(([^)]*)\)|(\w+))\s*=>\s*\{([\s\S]*)\}\s*$/);
      if (m) return (m[3] || '').trim();

      // Arrow without braces: (...) => expr
      m = code.match(/^(?:\(([^)]*)\)|(\w+))\s*=>\s*([\s\S]+)$/);
      if (m) return (m[3] || '').trim();

      // function(...) { body }
      m = code.match(/^function\s*(?:\w+)?\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/);
      if (m) return (m[2] || '').trim();

      return code;
    }

    /** Extract .then() chain from a Promise chain */
    _extractThenChain(stmt, line) {
      const thens = [];
      const thenRegex = /\.then\s*\(\s*/g;
      let match;
      let searchStr = stmt;

      while ((match = thenRegex.exec(searchStr)) !== null) {
        const start = match.index + match[0].length;
        // Find the matching closing paren
        let depth = 1;
        let i = start;
        let inStr = false;
        let strCh = '';

        while (i < searchStr.length && depth > 0) {
          const ch = searchStr[i];
          if (inStr) {
            if (ch === strCh && searchStr[i - 1] !== '\\') inStr = false;
          } else if (ch === '"' || ch === "'" || ch === '`') {
            inStr = true;
            strCh = ch;
          } else if (ch === '(') depth++;
          else if (ch === ')') depth--;
          i++;
        }

        const callbackCode = searchStr.substring(start, i - 1).trim();
        const bodyCode = this._extractArrowOrFuncBody(callbackCode);
        thens.push({
          label: `then callback #${thens.length + 1}`,
          body: this._parseStatements(bodyCode, line + 1)
        });
      }

      return thens;
    }

    /** Find the matching closing brace starting from an opening brace */
    _findMatchingBrace(code, openPos) {
      let depth = 0;
      let inStr = false;
      let strCh = '';
      for (let i = openPos; i < code.length; i++) {
        const ch = code[i];
        if (inStr) {
          if (ch === strCh && code[i - 1] !== '\\') inStr = false;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; }
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) return i; }
      }
      return code.length;
    }

    /** Get 0-based line number for a character index */
    _getLineNumber(charIndex) {
      let line = 0;
      let pos = 0;
      for (let i = 0; i < this.lines.length; i++) {
        pos += this.lines[i].length + 1; // +1 for \n
        if (pos > charIndex) { line = i; break; }
      }
      return line;
    }
  }

  /* ============================
     Execution Engine
     ============================ */
  class ExecutionEngine {
    constructor() {
      this.parser = new Parser();
      this.steps = [];
      this.functions = new Map();
    }

    /**
     * Parse code and generate all simulation steps.
     * Returns an array of step objects.
     */
    generate(code) {
      this.steps = [];
      this._pendingWebAPIs = [];
      this._pendingMicrotasks = [];
      this._stepCounter = 0;

      const parsed = this.parser.parse(code);
      this.functions = parsed.functions;

      // Push global execution context
      this._addStep(StepType.PUSH_STACK, {
        label: 'main()',
        detail: 'Global execution context created. This is the entry point of your script.',
        line: 0
      });

      // Process top-level statements
      for (const stmt of parsed.topLevel) {
        this._processStatement(stmt);
      }

      // Pop global context
      this._addStep(StepType.POP_STACK, {
        label: 'main()',
        detail: 'All synchronous code has finished executing. Global context removed from call stack.'
      });

      // Process event loop (async callbacks)
      this._processEventLoop();

      return this.steps;
    }

    _addStep(type, data) {
      this._stepCounter++;
      this.steps.push({
        id: this._stepCounter,
        type,
        label: data.label || '',
        detail: data.detail || '',
        line: data.line ?? null,
        callbackBody: data.callbackBody || null,
        callbackLabel: data.callbackLabel || null,
        queueType: data.queueType || null
      });
    }

    _processStatement(stmt) {
      if (!stmt) return;

      switch (stmt.type) {
        case 'console_log':
          this._processConsoleLog(stmt);
          break;
        case 'function_call':
          this._processFunctionCall(stmt);
          break;
        case 'set_timeout':
          this._processSetTimeout(stmt);
          break;
        case 'promise_chain':
          this._processPromiseChain(stmt);
          break;
        case 'new_promise':
          this._processNewPromise(stmt);
          break;
        case 'await':
          this._processAwait(stmt);
          break;
        case 'return':
          this._processReturn(stmt);
          break;
        case 'resolve_reject':
          this._processResolveReject(stmt);
          break;
        case 'expression':
          this._addStep(StepType.HIGHLIGHT_LINE, {
            label: stmt.raw,
            detail: `Executing expression: ${stmt.raw}`,
            line: stmt.line
          });
          break;
      }
    }

    _processConsoleLog(stmt) {
      this._addStep(StepType.HIGHLIGHT_LINE, {
        label: stmt.raw,
        detail: `About to execute console.log(${stmt.args})`,
        line: stmt.line
      });

      this._addStep(StepType.PUSH_STACK, {
        label: `console.log(${stmt.args})`,
        detail: `console.log() is pushed onto the call stack.`,
        line: stmt.line
      });

      this._addStep(StepType.LOG, {
        label: this._evaluateLogArgs(stmt.args),
        detail: `Output: ${this._evaluateLogArgs(stmt.args)}`
      });

      this._addStep(StepType.POP_STACK, {
        label: `console.log(${stmt.args})`,
        detail: `console.log() finishes and is popped from the call stack.`
      });
    }

    _processFunctionCall(stmt) {
      const func = this.functions.get(stmt.name);

      this._addStep(StepType.HIGHLIGHT_LINE, {
        label: stmt.raw,
        detail: `Calling function ${stmt.name}()`,
        line: stmt.line
      });

      if (func) {
        this._addStep(StepType.PUSH_STACK, {
          label: `${stmt.name}()`,
          detail: `Function ${stmt.name}() is pushed onto the call stack.${func.isAsync ? ' This is an async function.' : ''}`,
          line: func.startLine
        });

        // Process function body
        for (const bodyStmt of func.body) {
          this._processStatement(bodyStmt);
        }

        this._addStep(StepType.POP_STACK, {
          label: `${stmt.name}()`,
          detail: `Function ${stmt.name}() returns and is popped from the call stack.`
        });
      } else {
        // Unknown function — just show push/pop
        this._addStep(StepType.PUSH_STACK, {
          label: `${stmt.name}()`,
          detail: `Function ${stmt.name}() is pushed onto the call stack.`,
          line: stmt.line
        });
        this._addStep(StepType.POP_STACK, {
          label: `${stmt.name}()`,
          detail: `Function ${stmt.name}() returns and is popped from the call stack.`
        });
      }
    }

    _processSetTimeout(stmt) {
      this._addStep(StepType.HIGHLIGHT_LINE, {
        label: `setTimeout(..., ${stmt.delay})`,
        detail: `About to call setTimeout with a ${stmt.delay}ms delay.`,
        line: stmt.line
      });

      this._addStep(StepType.PUSH_STACK, {
        label: 'setTimeout()',
        detail: `setTimeout() is pushed onto the call stack. It will register the callback with Web APIs.`,
        line: stmt.line
      });

      this._addStep(StepType.REGISTER_WEBAPI, {
        label: `Timer (${stmt.delay}ms)`,
        detail: `The callback is registered with Web APIs as a timer. The browser will track the ${stmt.delay}ms delay outside the JS engine.`,
        callbackBody: stmt.callback.body,
        callbackLabel: stmt.callback.label
      });

      this._addStep(StepType.POP_STACK, {
        label: 'setTimeout()',
        detail: `setTimeout() returns immediately and is popped from the call stack. The callback will execute later.`
      });

      // Record pending Web API
      this._pendingWebAPIs.push({
        label: `Timer (${stmt.delay}ms)`,
        delay: stmt.delay,
        callback: stmt.callback,
        queueType: 'callback'
      });
    }

    _processPromiseChain(stmt) {
      this._addStep(StepType.HIGHLIGHT_LINE, {
        label: 'Promise.resolve().then(...)',
        detail: `Creating a resolved Promise and registering .then() callbacks.`,
        line: stmt.line
      });

      this._addStep(StepType.PUSH_STACK, {
        label: 'Promise.resolve()',
        detail: `Promise.resolve() is pushed onto the call stack. It creates an already-resolved Promise.`,
        line: stmt.line
      });

      // Each .then() registers a microtask
      for (let i = 0; i < stmt.thens.length; i++) {
        const then = stmt.thens[i];

        if (i === 0) {
          // First .then() - registers as microtask immediately (Promise is resolved)
          this._addStep(StepType.ENQUEUE_MICROTASK, {
            label: then.label,
            detail: `Since the Promise is already resolved, the .then() callback is queued as a microtask. Microtasks have higher priority than macrotasks (setTimeout).`,
            callbackBody: then.body,
            callbackLabel: then.label
          });

          this._pendingMicrotasks.push({
            label: then.label,
            callback: then,
            // If there are chained .then()s, the subsequent ones are dependent
            chainedThens: stmt.thens.slice(i + 1)
          });
        }
        // Subsequent .then()s will be registered when the previous .then() resolves
      }

      this._addStep(StepType.POP_STACK, {
        label: 'Promise.resolve()',
        detail: `Promise setup finishes. The .then() callbacks will run after all synchronous code completes.`
      });
    }

    _processNewPromise(stmt) {
      this._addStep(StepType.HIGHLIGHT_LINE, {
        label: 'new Promise(...)',
        detail: `Creating a new Promise. The executor function runs synchronously.`,
        line: stmt.line
      });

      this._addStep(StepType.PUSH_STACK, {
        label: 'new Promise()',
        detail: `The Promise constructor is pushed onto the call stack. The executor callback runs immediately (synchronously).`,
        line: stmt.line
      });

      this._addStep(StepType.PUSH_STACK, {
        label: 'Promise executor',
        detail: `The executor function runs synchronously inside the Promise constructor.`,
        line: stmt.line
      });

      // Process executor body
      for (const bodyStmt of stmt.callback.body) {
        this._processStatement(bodyStmt);
      }

      this._addStep(StepType.POP_STACK, {
        label: 'Promise executor',
        detail: `The Promise executor finishes.`
      });

      this._addStep(StepType.POP_STACK, {
        label: 'new Promise()',
        detail: `The Promise constructor returns.`
      });
    }

    _processAwait(stmt) {
      this._addStep(StepType.HIGHLIGHT_LINE, {
        label: stmt.raw,
        detail: `Encountering await. The async function will pause here and return a Promise.`,
        line: stmt.line
      });

      // Process the awaited expression first
      if (stmt.expression) {
        this._processStatement(stmt.expression);
      }

      this._addStep(StepType.POP_STACK, {
        label: 'async function (paused)',
        detail: `The async function is suspended at the await. Control returns to the caller. The continuation is registered as a microtask that will run when the awaited Promise resolves.`
      });

      // The continuation after await will be handled as a microtask
      // We don't have the actual continuation statements here in this simple parser,
      // so we note it for the event loop
    }

    _processReturn(stmt) {
      if (stmt.value) {
        this._processStatement(stmt.value);
      }
    }

    _processResolveReject(stmt) {
      this._addStep(StepType.HIGHLIGHT_LINE, {
        label: stmt.raw,
        detail: `Calling ${stmt.which}(${stmt.args}). This settles the Promise.`,
        line: stmt.line
      });
    }

    /** Process the event loop phase — drain microtasks then macrotasks */
    _processEventLoop() {
      if (this._pendingWebAPIs.length === 0 && this._pendingMicrotasks.length === 0) return;

      // Complete all Web APIs (timers fire)
      for (const api of this._pendingWebAPIs) {
        this._addStep(StepType.WEBAPI_COMPLETE, {
          label: api.label,
          detail: `${api.label} has completed in Web APIs. The callback is ready to be moved to the ${api.queueType === 'microtask' ? 'Microtask' : 'Callback'} Queue.`
        });

        this._addStep(StepType.ENQUEUE_CALLBACK, {
          label: api.callback.label,
          detail: `The callback from ${api.label} is moved to the Callback Queue (macrotask queue). It will wait until the call stack is empty and all microtasks are processed.`,
          callbackBody: api.callback.body,
          callbackLabel: api.callback.label
        });
      }

      // Event loop: process microtasks first, then macrotasks
      this._addStep(StepType.EVENT_LOOP_CHECK, {
        label: 'Event Loop',
        detail: 'The event loop checks: Is the call stack empty? Yes. Are there microtasks? Let\'s check the microtask queue first (microtasks always have priority over macrotasks).'
      });

      // Process microtasks
      const microtasks = [...this._pendingMicrotasks];
      this._pendingMicrotasks = [];

      for (const mt of microtasks) {
        this._addStep(StepType.DEQUEUE_MICROTASK, {
          label: mt.label,
          detail: `Microtask "${mt.label}" is dequeued. The event loop pushes it onto the call stack.`
        });

        this._addStep(StepType.PUSH_STACK, {
          label: mt.label,
          detail: `Microtask "${mt.label}" is now executing on the call stack.`
        });

        // Execute microtask body
        if (mt.callback && mt.callback.body) {
          for (const stmt of mt.callback.body) {
            this._processStatement(stmt);
          }
        }

        this._addStep(StepType.POP_STACK, {
          label: mt.label,
          detail: `Microtask "${mt.label}" finishes and is removed from the call stack.`
        });

        // If there are chained .then()s, register them as microtasks now
        if (mt.chainedThens && mt.chainedThens.length > 0) {
          const nextThen = mt.chainedThens[0];
          this._addStep(StepType.ENQUEUE_MICROTASK, {
            label: nextThen.label,
            detail: `The previous .then() returned, so the next chained .then() callback is now queued as a microtask.`,
            callbackBody: nextThen.body,
            callbackLabel: nextThen.label
          });

          this._pendingMicrotasks.push({
            label: nextThen.label,
            callback: nextThen,
            chainedThens: mt.chainedThens.slice(1)
          });
        }
      }

      // If new microtasks were added, process them before macrotasks
      if (this._pendingMicrotasks.length > 0) {
        this._addStep(StepType.EVENT_LOOP_CHECK, {
          label: 'Event Loop',
          detail: 'New microtasks were added. The event loop processes all microtasks before moving to macrotasks.'
        });

        // Recursively process new microtasks
        const newMicrotasks = [...this._pendingMicrotasks];
        this._pendingMicrotasks = [];

        for (const mt of newMicrotasks) {
          this._addStep(StepType.DEQUEUE_MICROTASK, {
            label: mt.label,
            detail: `Microtask "${mt.label}" is dequeued and pushed onto the call stack.`
          });

          this._addStep(StepType.PUSH_STACK, {
            label: mt.label,
            detail: `Microtask "${mt.label}" is executing.`
          });

          if (mt.callback && mt.callback.body) {
            for (const stmt of mt.callback.body) {
              this._processStatement(stmt);
            }
          }

          this._addStep(StepType.POP_STACK, {
            label: mt.label,
            detail: `Microtask "${mt.label}" completes.`
          });

          // Handle further chained thens
          if (mt.chainedThens && mt.chainedThens.length > 0) {
            const nextThen = mt.chainedThens[0];
            this._pendingMicrotasks.push({
              label: nextThen.label,
              callback: nextThen,
              chainedThens: mt.chainedThens.slice(1)
            });
          }
        }

        // Handle any remaining microtasks (deeply chained)
        if (this._pendingMicrotasks.length > 0) {
          this._processEventLoop(); // recursive for remaining
          return;
        }
      }

      // Now process macrotasks (callback queue)
      if (this._pendingWebAPIs.length > 0) {
        this._addStep(StepType.EVENT_LOOP_CHECK, {
          label: 'Event Loop',
          detail: 'All microtasks are done. The event loop now checks the Callback Queue (macrotask queue).'
        });

        for (const api of this._pendingWebAPIs) {
          this._addStep(StepType.DEQUEUE_CALLBACK, {
            label: api.callback.label,
            detail: `Callback "${api.callback.label}" is dequeued from the Callback Queue and pushed onto the call stack.`
          });

          this._addStep(StepType.PUSH_STACK, {
            label: api.callback.label,
            detail: `Callback from ${api.label} is now executing on the call stack.`
          });

          if (api.callback.body) {
            for (const stmt of api.callback.body) {
              this._processStatement(stmt);
            }
          }

          this._addStep(StepType.POP_STACK, {
            label: api.callback.label,
            detail: `Callback "${api.callback.label}" finishes and is removed from the call stack.`
          });

          // After each macrotask, check for microtasks again
          if (this._pendingMicrotasks.length > 0) {
            this._addStep(StepType.EVENT_LOOP_CHECK, {
              label: 'Event Loop',
              detail: 'After macrotask, the event loop checks for new microtasks before processing the next macrotask.'
            });
          }
        }
        this._pendingWebAPIs = [];
      }
    }

    /** Simple evaluation of console.log arguments for display */
    _evaluateLogArgs(args) {
      // Strip outer quotes for simple string args
      let result = args.trim();
      if ((result.startsWith('"') && result.endsWith('"')) ||
          (result.startsWith("'") && result.endsWith("'"))) {
        result = result.slice(1, -1);
      }
      // Handle string concatenation with + for simple cases
      result = result.replace(/"\s*\+\s*"/g, '');
      result = result.replace(/'\s*\+\s*'/g, '');
      // Handle "string" + variable patterns (just show as-is for education)
      return result;
    }
  }

  // Exports
  ns.StepType = StepType;
  ns.Parser = Parser;
  ns.ExecutionEngine = ExecutionEngine;
  ns.EXAMPLES = EXAMPLES;
})(window.JSDebugger);
