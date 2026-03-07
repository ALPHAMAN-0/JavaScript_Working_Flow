/**
 * Main Entry Point
 * Wires together the engine, UI, and user controls.
 */
(function () {
  'use strict';

  const { ExecutionEngine, EXAMPLES, StepType } = window.JSDebugger;
  const UI = window.JSDebugger.UI;

  /* ============================
     State
     ============================ */
  const state = {
    steps: [],
    currentStep: 0,
    status: 'idle',       // idle | running | paused | complete
    intervalId: null,
    speed: 5              // 1-10
  };

  /* ============================
     DOM References
     ============================ */
  const btnRun = document.getElementById('btn-run');
  const btnPause = document.getElementById('btn-pause');
  const btnStep = document.getElementById('btn-step');
  const btnReset = document.getElementById('btn-reset');
  const btnClearLog = document.getElementById('btn-clear-log');
  const speedSlider = document.getElementById('speed-slider');
  const speedLabel = document.getElementById('speed-label');
  const editor = document.getElementById('code-editor');

  /* ============================
     Speed Mapping
     ============================ */
  function getDelay() {
    // Speed 1 = 2000ms, Speed 10 = 150ms
    const delays = [2000, 1600, 1300, 1050, 850, 700, 550, 400, 280, 150];
    return delays[state.speed - 1] || 700;
  }

  /* ============================
     Control Functions
     ============================ */
  function generateSteps() {
    const code = editor.value.trim();
    if (!code) return false;

    const engine = new ExecutionEngine();
    state.steps = engine.generate(code);
    state.currentStep = 0;

    UI.setTotalSteps(state.steps.length);
    return state.steps.length > 0;
  }

  function executeNextStep() {
    if (state.currentStep >= state.steps.length) {
      completeSimulation();
      return false;
    }

    const step = state.steps[state.currentStep];
    UI.processStep(step);
    state.currentStep++;

    if (state.currentStep >= state.steps.length) {
      completeSimulation();
      return false;
    }
    return true;
  }

  function startAutoPlay() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(() => {
      if (!executeNextStep()) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
    }, getDelay());
  }

  function completeSimulation() {
    state.status = 'complete';
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    UI.clearLineHighlights();
    UI.setEventLoopActive(false, 'Done');
    UI.updateDebugInfo({
      status: 'Complete',
      currentFn: '-',
      stackDepth: 0,
      pendingAPIs: 0,
      pendingCallbacks: 0,
      pendingMicrotasks: 0,
      stepIndex: state.steps.length,
      totalSteps: state.steps.length
    });
    updateButtons();
  }

  /* ============================
     Button Handlers
     ============================ */
  function onRun() {
    if (state.status === 'idle' || state.status === 'complete') {
      UI.resetAll();
      if (!generateSteps()) return;
      state.status = 'running';
      editor.readOnly = true;
      UI.updateLineNumbers();
      UI.updateDebugInfo({
        status: 'Running',
        currentFn: '-',
        stackDepth: 0,
        pendingAPIs: 0,
        pendingCallbacks: 0,
        pendingMicrotasks: 0,
        stepIndex: 0,
        totalSteps: state.steps.length
      });
      startAutoPlay();
    } else if (state.status === 'paused') {
      state.status = 'running';
      startAutoPlay();
    }
    updateButtons();
  }

  function onPause() {
    if (state.status === 'running') {
      state.status = 'paused';
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
    }
    updateButtons();
  }

  function onStep() {
    if (state.status === 'idle' || state.status === 'complete') {
      UI.resetAll();
      if (!generateSteps()) return;
      state.status = 'paused';
      editor.readOnly = true;
      UI.updateLineNumbers();
    }
    if (state.status === 'running') {
      // Pause first, then user can step
      onPause();
    }
    if (state.status === 'paused') {
      executeNextStep();
    }
    updateButtons();
  }

  function onReset() {
    state.status = 'idle';
    state.steps = [];
    state.currentStep = 0;
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    editor.readOnly = false;
    UI.resetAll();
    updateButtons();
  }

  function updateButtons() {
    const isIdle = state.status === 'idle';
    const isRunning = state.status === 'running';
    const isPaused = state.status === 'paused';
    const isComplete = state.status === 'complete';

    btnRun.disabled = isRunning;
    btnRun.innerHTML = isPaused
      ? '<span class="btn-icon">&#9654;</span> Resume'
      : '<span class="btn-icon">&#9654;</span> Run';

    btnPause.disabled = !isRunning;
    btnStep.disabled = isRunning || isComplete;
    btnReset.disabled = isIdle;
  }

  /* ============================
     Example Buttons
     ============================ */
  function loadExample(name) {
    if (EXAMPLES[name]) {
      onReset();
      editor.value = EXAMPLES[name];
      UI.updateLineNumbers();
    }
  }

  /* ============================
     Speed Control
     ============================ */
  function onSpeedChange() {
    state.speed = parseInt(speedSlider.value, 10);
    speedLabel.textContent = state.speed + 'x';
    // If running, restart interval with new speed
    if (state.status === 'running' && state.intervalId) {
      clearInterval(state.intervalId);
      startAutoPlay();
    }
  }

  /* ============================
     Editor Sync
     ============================ */
  function onEditorInput() {
    UI.updateLineNumbers();
  }

  function onEditorScroll() {
    const lineNumbers = document.getElementById('line-numbers');
    lineNumbers.scrollTop = editor.scrollTop;
  }

  /* ============================
     Keyboard Shortcuts
     ============================ */
  function onKeydown(e) {
    // Ctrl+Enter or Cmd+Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (state.status === 'running') return;
      onRun();
    }
    // Space to step (when not in editor)
    if (e.key === ' ' && document.activeElement !== editor) {
      e.preventDefault();
      onStep();
    }
    // Escape to reset
    if (e.key === 'Escape') {
      e.preventDefault();
      onReset();
    }
  }

  /* ============================
     Tab support in editor
     ============================ */
  function onEditorKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      UI.updateLineNumbers();
    }
  }

  /* ============================
     Initialize
     ============================ */
  function init() {
    // Button listeners
    btnRun.addEventListener('click', onRun);
    btnPause.addEventListener('click', onPause);
    btnStep.addEventListener('click', onStep);
    btnReset.addEventListener('click', onReset);
    btnClearLog.addEventListener('click', () => UI.clearLogs());

    // Speed slider
    speedSlider.addEventListener('input', onSpeedChange);

    // Example buttons
    document.querySelectorAll('.btn-example').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-example').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadExample(btn.dataset.example);
      });
    });

    // Editor
    editor.addEventListener('input', onEditorInput);
    editor.addEventListener('scroll', onEditorScroll);
    editor.addEventListener('keydown', onEditorKeydown);

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeydown);

    // Initial line numbers
    UI.updateLineNumbers();

    // Initial button states
    updateButtons();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
