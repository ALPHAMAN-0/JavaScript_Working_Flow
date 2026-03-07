/**
 * UI Module
 * Handles all DOM updates, rendering, and animations for the visualizer.
 */
window.JSDebugger = window.JSDebugger || {};

(function (ns) {
  'use strict';

  const StepType = ns.StepType;

  /* ============================
     DOM References
     ============================ */
  const dom = {
    get editor()          { return document.getElementById('code-editor'); },
    get lineNumbers()     { return document.getElementById('line-numbers'); },
    get callStack()       { return document.getElementById('call-stack'); },
    get webAPIs()         { return document.getElementById('web-apis'); },
    get callbackQueue()   { return document.getElementById('callback-queue'); },
    get microtaskQueue()  { return document.getElementById('microtask-queue'); },
    get eventLoopCircle() { return document.getElementById('event-loop-circle'); },
    get eventLoopStatus() { return document.getElementById('event-loop-status'); },
    get executionLog()    { return document.getElementById('execution-log'); },
    get consoleOutput()   { return document.getElementById('console-output'); },
    get educationText()   { return document.getElementById('education-text'); },
    get debugStatus()     { return document.getElementById('debug-status'); },
    get debugCurrentFn()  { return document.getElementById('debug-current-fn'); },
    get debugStackDepth() { return document.getElementById('debug-stack-depth'); },
    get debugPendingAPIs(){ return document.getElementById('debug-pending-apis'); },
    get debugPendingCBs() { return document.getElementById('debug-pending-callbacks'); },
    get debugPendingMTs() { return document.getElementById('debug-pending-microtasks'); },
    get debugStep()       { return document.getElementById('debug-step'); }
  };

  /* ============================
     UI State
     ============================ */
  const uiState = {
    stackFrames: [],     // Current stack frame elements
    webapiItems: [],     // Current Web API elements
    callbackItems: [],   // Current callback queue elements
    microtaskItems: [],  // Current microtask queue elements
    stepIndex: 0,
    totalSteps: 0,
    logCount: 0
  };

  /* ============================
     Rendering Functions
     ============================ */

  /** Update line numbers in the code editor */
  function updateLineNumbers() {
    const editor = dom.editor;
    const container = dom.lineNumbers;
    const lines = editor.value.split('\n');
    container.innerHTML = '';
    for (let i = 0; i < lines.length; i++) {
      const span = document.createElement('span');
      span.className = 'line-num';
      span.dataset.line = i;
      span.textContent = i + 1;
      container.appendChild(span);
    }
  }

  /** Highlight a specific line in the editor */
  function highlightLine(lineNum) {
    clearLineHighlights();
    if (lineNum == null || lineNum < 0) return;
    const lineEl = dom.lineNumbers.querySelector(`.line-num[data-line="${lineNum}"]`);
    if (lineEl) {
      lineEl.classList.add('active');
      lineEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function clearLineHighlights() {
    dom.lineNumbers.querySelectorAll('.line-num.active').forEach(el => el.classList.remove('active'));
  }

  /** Render call stack push */
  function renderStackPush(label) {
    const container = dom.callStack;
    // Remove empty message
    const emptyMsg = container.querySelector('.stack-empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const frame = document.createElement('div');
    frame.className = `stack-frame color-${label === 'main()' ? 'main' : uiState.stackFrames.length % 5}`;
    frame.textContent = label;
    frame.dataset.label = label;
    container.appendChild(frame);
    uiState.stackFrames.push(frame);
  }

  /** Render call stack pop with animation */
  function renderStackPop(label) {
    const container = dom.callStack;
    // Find the topmost frame matching the label (or just pop the top)
    let frame = null;
    for (let i = uiState.stackFrames.length - 1; i >= 0; i--) {
      if (uiState.stackFrames[i].dataset.label === label) {
        frame = uiState.stackFrames[i];
        uiState.stackFrames.splice(i, 1);
        break;
      }
    }
    if (!frame && uiState.stackFrames.length > 0) {
      frame = uiState.stackFrames.pop();
    }
    if (frame) {
      frame.classList.add('popping');
      setTimeout(() => {
        frame.remove();
        if (uiState.stackFrames.length === 0) {
          showStackEmpty();
        }
      }, 400);
    }
  }

  function showStackEmpty() {
    const container = dom.callStack;
    if (!container.querySelector('.stack-empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'stack-empty-msg';
      msg.textContent = 'Stack is empty';
      container.appendChild(msg);
    }
  }

  function clearStack() {
    dom.callStack.innerHTML = '';
    uiState.stackFrames = [];
    showStackEmpty();
  }

  /** Render Web API registration */
  function renderWebAPIRegister(label) {
    const container = dom.webAPIs;
    const emptyMsg = container.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const item = document.createElement('div');
    item.className = 'webapi-item';
    item.dataset.label = label;
    item.innerHTML = `<span>${label}</span><span class="webapi-timer">Running...</span>`;
    container.appendChild(item);
    uiState.webapiItems.push(item);
  }

  /** Render Web API completion */
  function renderWebAPIComplete(label) {
    let item = null;
    for (let i = 0; i < uiState.webapiItems.length; i++) {
      if (uiState.webapiItems[i].dataset.label === label) {
        item = uiState.webapiItems[i];
        uiState.webapiItems.splice(i, 1);
        break;
      }
    }
    if (!item && uiState.webapiItems.length > 0) {
      item = uiState.webapiItems.shift();
    }
    if (item) {
      item.classList.add('completing');
      setTimeout(() => {
        item.remove();
        if (uiState.webapiItems.length === 0) {
          showWebAPIsEmpty();
        }
      }, 400);
    }
  }

  function showWebAPIsEmpty() {
    const container = dom.webAPIs;
    if (!container.querySelector('.empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'empty-msg';
      msg.textContent = 'No active APIs';
      container.appendChild(msg);
    }
  }

  function clearWebAPIs() {
    dom.webAPIs.innerHTML = '';
    uiState.webapiItems = [];
    showWebAPIsEmpty();
  }

  /** Render callback queue enqueue */
  function renderCallbackEnqueue(label) {
    const container = dom.callbackQueue;
    const emptyMsg = container.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const item = document.createElement('div');
    item.className = 'queue-item callback';
    item.textContent = label;
    item.dataset.label = label;
    container.appendChild(item);
    uiState.callbackItems.push(item);
  }

  /** Render callback dequeue */
  function renderCallbackDequeue(label) {
    let item = null;
    for (let i = 0; i < uiState.callbackItems.length; i++) {
      if (uiState.callbackItems[i].dataset.label === label) {
        item = uiState.callbackItems[i];
        uiState.callbackItems.splice(i, 1);
        break;
      }
    }
    if (!item && uiState.callbackItems.length > 0) {
      item = uiState.callbackItems.shift();
    }
    if (item) {
      item.classList.add('dequeuing');
      setTimeout(() => {
        item.remove();
        if (uiState.callbackItems.length === 0) {
          showCallbackEmpty();
        }
      }, 400);
    }
  }

  function showCallbackEmpty() {
    const container = dom.callbackQueue;
    if (!container.querySelector('.empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'empty-msg';
      msg.textContent = 'Empty';
      container.appendChild(msg);
    }
  }

  function clearCallbackQueue() {
    dom.callbackQueue.innerHTML = '';
    uiState.callbackItems = [];
    showCallbackEmpty();
  }

  /** Render microtask queue enqueue */
  function renderMicrotaskEnqueue(label) {
    const container = dom.microtaskQueue;
    const emptyMsg = container.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const item = document.createElement('div');
    item.className = 'queue-item microtask';
    item.textContent = label;
    item.dataset.label = label;
    container.appendChild(item);
    uiState.microtaskItems.push(item);
  }

  /** Render microtask dequeue */
  function renderMicrotaskDequeue(label) {
    let item = null;
    for (let i = 0; i < uiState.microtaskItems.length; i++) {
      if (uiState.microtaskItems[i].dataset.label === label) {
        item = uiState.microtaskItems[i];
        uiState.microtaskItems.splice(i, 1);
        break;
      }
    }
    if (!item && uiState.microtaskItems.length > 0) {
      item = uiState.microtaskItems.shift();
    }
    if (item) {
      item.classList.add('dequeuing');
      setTimeout(() => {
        item.remove();
        if (uiState.microtaskItems.length === 0) {
          showMicrotaskEmpty();
        }
      }, 400);
    }
  }

  function showMicrotaskEmpty() {
    const container = dom.microtaskQueue;
    if (!container.querySelector('.empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'empty-msg';
      msg.textContent = 'Empty';
      container.appendChild(msg);
    }
  }

  function clearMicrotaskQueue() {
    dom.microtaskQueue.innerHTML = '';
    uiState.microtaskItems = [];
    showMicrotaskEmpty();
  }

  /** Event loop visualization */
  function setEventLoopActive(active, statusText) {
    const circle = dom.eventLoopCircle;
    const status = dom.eventLoopStatus;
    if (active) {
      circle.classList.add('active', 'spinning');
      status.classList.add('active');
      status.textContent = statusText || 'Checking...';
    } else {
      circle.classList.remove('active', 'spinning');
      status.classList.remove('active');
      status.textContent = statusText || 'Idle';
    }
  }

  /** Add execution log entry */
  function addLogEntry(step) {
    uiState.logCount++;
    const container = dom.executionLog;
    const entry = document.createElement('div');

    let cssClass = 'log-info';
    let icon = '';

    switch (step.type) {
      case StepType.PUSH_STACK:
        cssClass = 'log-push';
        icon = '+';
        break;
      case StepType.POP_STACK:
        cssClass = 'log-pop';
        icon = '-';
        break;
      case StepType.REGISTER_WEBAPI:
        cssClass = 'log-webapi';
        icon = '~';
        break;
      case StepType.WEBAPI_COMPLETE:
        cssClass = 'log-webapi';
        icon = '!';
        break;
      case StepType.ENQUEUE_CALLBACK:
        cssClass = 'log-queue';
        icon = '>';
        break;
      case StepType.DEQUEUE_CALLBACK:
        cssClass = 'log-queue';
        icon = '<';
        break;
      case StepType.ENQUEUE_MICROTASK:
        cssClass = 'log-microtask';
        icon = '>';
        break;
      case StepType.DEQUEUE_MICROTASK:
        cssClass = 'log-microtask';
        icon = '<';
        break;
      case StepType.EVENT_LOOP_CHECK:
        cssClass = 'log-eventloop';
        icon = '#';
        break;
      case StepType.LOG:
        cssClass = 'log-output';
        icon = '*';
        break;
      case StepType.HIGHLIGHT_LINE:
        cssClass = 'log-info';
        icon = '>';
        break;
    }

    entry.className = `log-entry ${cssClass}`;
    entry.innerHTML = `
      <span class="log-step">${uiState.logCount}</span>
      <span class="log-icon">${icon}</span>
      <span>${getStepDescription(step)}</span>
    `;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  /** Add console output line */
  function addConsoleLine(text) {
    const container = dom.consoleOutput;
    const line = document.createElement('div');
    line.className = 'console-line';
    line.textContent = text;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }

  /** Update educational explanation */
  function updateEducation(step) {
    const container = dom.educationText;

    let typeClass = 'type-info';
    let typeLabel = 'INFO';

    switch (step.type) {
      case StepType.PUSH_STACK:
        typeClass = 'type-push'; typeLabel = 'CALL STACK PUSH'; break;
      case StepType.POP_STACK:
        typeClass = 'type-pop'; typeLabel = 'CALL STACK POP'; break;
      case StepType.REGISTER_WEBAPI:
        typeClass = 'type-webapi'; typeLabel = 'WEB API'; break;
      case StepType.WEBAPI_COMPLETE:
        typeClass = 'type-webapi'; typeLabel = 'WEB API COMPLETE'; break;
      case StepType.ENQUEUE_CALLBACK:
        typeClass = 'type-queue'; typeLabel = 'CALLBACK QUEUE'; break;
      case StepType.DEQUEUE_CALLBACK:
        typeClass = 'type-queue'; typeLabel = 'DEQUEUE CALLBACK'; break;
      case StepType.ENQUEUE_MICROTASK:
        typeClass = 'type-microtask'; typeLabel = 'MICROTASK QUEUE'; break;
      case StepType.DEQUEUE_MICROTASK:
        typeClass = 'type-microtask'; typeLabel = 'DEQUEUE MICROTASK'; break;
      case StepType.EVENT_LOOP_CHECK:
        typeClass = 'type-eventloop'; typeLabel = 'EVENT LOOP'; break;
      case StepType.LOG:
        typeClass = 'type-output'; typeLabel = 'OUTPUT'; break;
      case StepType.HIGHLIGHT_LINE:
        typeClass = 'type-info'; typeLabel = 'EXECUTING'; break;
    }

    const el = document.createElement('div');
    el.className = `education-step ${typeClass}`;
    el.innerHTML = `<div class="step-type">${typeLabel}</div><div>${step.detail || step.label}</div>`;

    // Keep only last 5 explanations
    while (container.children.length >= 5) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  /** Update debug info panel */
  function updateDebugInfo(state) {
    dom.debugStatus.textContent = state.status || 'Idle';
    dom.debugCurrentFn.textContent = state.currentFn || '-';
    dom.debugStackDepth.textContent = state.stackDepth ?? 0;
    dom.debugPendingAPIs.textContent = state.pendingAPIs ?? 0;
    dom.debugPendingCBs.textContent = state.pendingCallbacks ?? 0;
    dom.debugPendingMTs.textContent = state.pendingMicrotasks ?? 0;
    dom.debugStep.textContent = `${state.stepIndex ?? 0} / ${state.totalSteps ?? 0}`;
  }

  /** Clear all log/console output */
  function clearLogs() {
    dom.executionLog.innerHTML = '';
    dom.consoleOutput.innerHTML = '';
    uiState.logCount = 0;
  }

  /** Clear education panel */
  function clearEducation() {
    dom.educationText.innerHTML = `
      <p>Write some JavaScript code and click <strong>Run</strong> or <strong>Step</strong> to see how the JavaScript engine processes it.</p>
      <p>The visualization shows how functions move through the <em>Call Stack</em>, how async operations use <em>Web APIs</em>, and how the <em>Event Loop</em> coordinates everything.</p>
    `;
  }

  /** Reset all visualizations */
  function resetAll() {
    clearStack();
    clearWebAPIs();
    clearCallbackQueue();
    clearMicrotaskQueue();
    clearLogs();
    clearEducation();
    clearLineHighlights();
    setEventLoopActive(false, 'Idle');
    updateDebugInfo({
      status: 'Idle',
      currentFn: '-',
      stackDepth: 0,
      pendingAPIs: 0,
      pendingCallbacks: 0,
      pendingMicrotasks: 0,
      stepIndex: 0,
      totalSteps: 0
    });
    uiState.stepIndex = 0;
    uiState.totalSteps = 0;
  }

  /** Get a human-readable description for a step */
  function getStepDescription(step) {
    switch (step.type) {
      case StepType.PUSH_STACK:
        return `${step.label} pushed to Call Stack`;
      case StepType.POP_STACK:
        return `${step.label} popped from Call Stack`;
      case StepType.REGISTER_WEBAPI:
        return `${step.label} registered in Web APIs`;
      case StepType.WEBAPI_COMPLETE:
        return `${step.label} completed in Web APIs`;
      case StepType.ENQUEUE_CALLBACK:
        return `${step.label || step.callbackLabel} moved to Callback Queue`;
      case StepType.DEQUEUE_CALLBACK:
        return `${step.label} dequeued from Callback Queue`;
      case StepType.ENQUEUE_MICROTASK:
        return `${step.label || step.callbackLabel} added to Microtask Queue`;
      case StepType.DEQUEUE_MICROTASK:
        return `${step.label} dequeued from Microtask Queue`;
      case StepType.EVENT_LOOP_CHECK:
        return `Event Loop: checking queues...`;
      case StepType.LOG:
        return `Output: "${step.label}"`;
      case StepType.HIGHLIGHT_LINE:
        return `Executing: ${step.label}`;
      default:
        return step.label || step.detail;
    }
  }

  /** Process a single step and update all UI components */
  function processStep(step) {
    uiState.stepIndex++;

    // Highlight line in editor
    if (step.line != null) {
      highlightLine(step.line);
    }

    switch (step.type) {
      case StepType.PUSH_STACK:
        renderStackPush(step.label);
        break;

      case StepType.POP_STACK:
        renderStackPop(step.label);
        break;

      case StepType.REGISTER_WEBAPI:
        renderWebAPIRegister(step.label);
        break;

      case StepType.WEBAPI_COMPLETE:
        renderWebAPIComplete(step.label);
        break;

      case StepType.ENQUEUE_CALLBACK:
        renderCallbackEnqueue(step.callbackLabel || step.label);
        break;

      case StepType.DEQUEUE_CALLBACK:
        renderCallbackDequeue(step.label);
        break;

      case StepType.ENQUEUE_MICROTASK:
        renderMicrotaskEnqueue(step.callbackLabel || step.label);
        break;

      case StepType.DEQUEUE_MICROTASK:
        renderMicrotaskDequeue(step.label);
        break;

      case StepType.EVENT_LOOP_CHECK:
        setEventLoopActive(true, 'Checking...');
        // Turn off after a brief delay (will be overridden if next step is also event loop)
        setTimeout(() => {
          if (uiState.stepIndex >= uiState.totalSteps) {
            setEventLoopActive(false, 'Done');
          }
        }, 800);
        break;

      case StepType.LOG:
        addConsoleLine(step.label);
        break;

      case StepType.HIGHLIGHT_LINE:
        // Just line highlighting and log, no stack changes
        break;
    }

    // Add log entry
    addLogEntry(step);

    // Update educational explanation
    updateEducation(step);

    // Update debug info
    updateDebugInfo({
      status: uiState.stepIndex >= uiState.totalSteps ? 'Complete' : 'Running',
      currentFn: uiState.stackFrames.length > 0
        ? uiState.stackFrames[uiState.stackFrames.length - 1]?.dataset?.label || '-'
        : '-',
      stackDepth: uiState.stackFrames.length,
      pendingAPIs: uiState.webapiItems.length,
      pendingCallbacks: uiState.callbackItems.length,
      pendingMicrotasks: uiState.microtaskItems.length,
      stepIndex: uiState.stepIndex,
      totalSteps: uiState.totalSteps
    });
  }

  /** Set total steps for progress tracking */
  function setTotalSteps(total) {
    uiState.totalSteps = total;
    uiState.stepIndex = 0;
  }

  // Exports
  ns.UI = {
    dom,
    uiState,
    updateLineNumbers,
    highlightLine,
    clearLineHighlights,
    processStep,
    resetAll,
    clearLogs,
    setTotalSteps,
    setEventLoopActive,
    updateDebugInfo
  };
})(window.JSDebugger);
