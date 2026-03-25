# JavaScript Engine Debugger Visualizer

An interactive educational tool that visualizes how the JavaScript runtime engine works. Write JavaScript code and watch it execute step-by-step through the Call Stack, Event Loop, Web APIs, and task queues.

## Features

- **Code Editor** with line numbers and syntax highlighting
- **Call Stack** visualization showing function execution order
- **Event Loop** animation demonstrating the check cycle
- **Web APIs** panel for async operations (setTimeout, fetch, etc.)
- **Microtask Queue** for Promises and async/await
- **Callback Queue** for setTimeout, setInterval, etc.
- **Execution Log** with timeline of all operations
- **Console Output** panel showing logged values
- **Debug Information** panel with real-time stats (stack depth, pending APIs, pending callbacks)

## Built-in Examples

- **Sync Call Stack** -- basic synchronous function calls
- **setTimeout** -- demonstrates the callback queue
- **Promise** -- shows microtask queue behavior
- **async/await** -- async function execution flow
- **Mixed Async** -- combines multiple async patterns

## How to Use

1. Open `index.html` in a web browser
2. Write JavaScript code in the editor or select a built-in example
3. Click **Run** to execute the full simulation, or **Step** to advance one action at a time
4. Click **Pause** to freeze mid-execution, and **Reset** to start over
5. Adjust the **Speed** slider to control simulation speed

## Project Structure

```
JavaScript_Working_Flow/
├── index.html       # Main page layout and UI
├── style.css        # Styling for all panels and animations
└── js/
    ├── stack.js     # Call Stack data structure
    ├── queue.js     # Queue data structure (callback + microtask)
    ├── engine.js    # JavaScript engine simulation logic
    ├── ui.js        # DOM manipulation and rendering
    └── main.js      # App initialization and event wiring
```

## Technologies

- HTML, CSS, JavaScript (vanilla, no frameworks)
- No build tools or dependencies required
