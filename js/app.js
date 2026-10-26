(() => {
  "use strict";

  const canvas = document.getElementById("graphCanvas");
  const ctx = canvas.getContext("2d");
  const equationInput = document.getElementById("equationInput");
  const applyBtn = document.getElementById("applyBtn");
  const errorMessage = document.getElementById("errorMessage");
  const playBtn = document.getElementById("playBtn");
  const playIcon = document.getElementById("playIcon");
  const playText = document.getElementById("playText");
  const resetBtn = document.getElementById("resetBtn");
  const speedRange = document.getElementById("speedRange");
  const amplitudeRange = document.getElementById("amplitudeRange");
  const frequencyRange = document.getElementById("frequencyRange");
  const speedValue = document.getElementById("speedValue");
  const amplitudeValue = document.getElementById("amplitudeValue");
  const frequencyValue = document.getElementById("frequencyValue");
  const coordinateReadout = document.getElementById("coordinateReadout");
  const graphLabel = document.getElementById("graphLabel");
  const legendEquation = document.getElementById("legendEquation");
  const gridToggle = document.getElementById("gridToggle");
  const drawToggle = document.getElementById("drawToggle");
  const glowToggle = document.getElementById("glowToggle");
  const pointToggle = document.getElementById("pointToggle");
  const axesToggle = document.getElementById("axesToggle");

  const state = {
    running: true,
    showGrid: true,
    time: 0,
    lastTime: 0,
    speed: 1,
    amplitude: 1,
    frequency: 1,
    equation: "sin(x - t)",
    compiled: null,
    error: "",
    mouse: null
  };

  // Safe math expression parser. It never uses eval() or Function().
  // Supports arithmetic, parentheses, x, t, constants, and whitelisted math functions.
  const FUNCTIONS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, abs: Math.abs, log: Math.log,
    log10: Math.log10, exp: Math.exp, floor: Math.floor,
    ceil: Math.ceil, round: Math.round, sign: Math.sign,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    min: Math.min, max: Math.max, pow: Math.pow
  };
  const CONSTANTS = { pi: Math.PI, e: Math.E };

  function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      const rest = source.slice(i);
      if (/^\s+/.test(rest)) { i += rest.match(/^\s+/)[0].length; continue; }
      const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (number) { tokens.push({ type: "number", value: Number(number[0]) }); i += number[0].length; continue; }
      const name = rest.match(/^[a-zA-Z_][a-zA-Z_0-9]*/);
      if (name) { tokens.push({ type: "name", value: name[0].toLowerCase() }); i += name[0].length; continue; }
      const ch = source[i];
      if ("+-*/^(),".includes(ch)) { tokens.push({ type: ch, value: ch }); i++; continue; }
      throw new Error(`Unsupported character: "${ch}"`);
    }
    tokens.push({ type: "eof" });
    return tokens;
  }

  function parseExpression(source) {
    const tokens = tokenize(source);
    let position = 0;
    const peek = () => tokens[position];
    const take = () => tokens[position++];

    function primary() {
      const token = take();
      if (token.type === "number") return () => token.value;
      if (token.type === "name") {
        const name = token.value;
        if (peek().type === "(") {
          if (!Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) throw new Error(`Unknown function: ${name}`);
          take();
          const args = [];
          if (peek().type !== ")") {
            args.push(expression());
            while (peek().type === ",") { take(); args.push(expression()); }
          }
          if (take().type !== ")") throw new Error("Missing closing parenthesis");
          const arity = args.length;
          if ((["min", "max"].includes(name) && arity < 1) ||
              (!["min", "max", "pow"].includes(name) && arity !== 1) ||
              (name === "pow" && arity !== 2)) {
            throw new Error(`Wrong number of arguments for ${name}()`);
          }
          return (scope) => FUNCTIONS[name](...args.map(fn => fn(scope)));
        }
        if (name === "x" || name === "t" || name === "a" || name === "w") return scope => scope[name] ?? 0;
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return () => CONSTANTS[name];
        throw new Error(`Unknown variable or constant: ${name}`);
      }
      if (token.type === "(") {
        const node = expression();
        if (take().type !== ")") throw new Error("Missing closing parenthesis");
        return node;
      }
      throw new Error("Expected a number, variable, or parenthesized expression");
    }

    function unary() {
      if (peek().type === "+") { take(); return unary(); }
      if (peek().type === "-") { take(); const node = unary(); return scope => -node(scope); }
      return primary();
    }
    function power() {
      let left = unary();
      if (peek().type === "^") { take(); const right = power(); const prev = left; left = scope => Math.pow(prev(scope), right(scope)); }
      return left;
    }
    function term() {
      let left = power();
      while (peek().type === "*" || peek().type === "/") {
        const op = take().type, right = power(), prev = left;
        left = op === "*" ? scope => prev(scope) * right(scope) : scope => prev(scope) / right(scope);
      }
      return left;
    }
    function expression() {
      let left = term();
      while (peek().type === "+" || peek().type === "-") {
        const op = take().type, right = term(), prev = left;
        left = op === "+" ? scope => prev(scope) + right(scope) : scope => prev(scope) - right(scope);
      }
      return left;
    }
    const tree = expression();
    if (peek().type !== "eof") throw new Error(`Unexpected token: ${peek().value}`);
    return tree;
  }

  function normalizeEquation(raw) {
    let source = raw.trim().toLowerCase().replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/π/g, "pi");
    source = source.replace(/^y\s*=\s*/, "").replace(/^f\s*\(\s*x\s*\)\s*=\s*/, "");
    if (!source) throw new Error("Enter an equation first.");
    if (source.length > 160) throw new Error("Equation is too long (maximum 160 characters).");
    // Insert implicit multiplication: 2x, 2(x), (x)(t), x sin(t), but not function calls.
    source = source.replace(/(\d|\)|\bx\b|\bt\b|\bpi\b|\be\b)\s*(?=(?:x|t|pi|e)\b|\()/g, "$1*");
    source = source.replace(/\b(x|t|pi|e)\s+(?=(?:sin|cos|tan|sqrt|abs|log|exp)\s*\()/g, "$1*");
    return source;
  }

  function compileEquation(raw) {
    const source = normalizeEquation(raw);
    return { source, fn: parseExpression(source) };
  }

  function safeEvaluate(x, t) {
    try {
      const result = state.compiled.fn({
        x: x * state.frequency,
        t: t * state.speed,
        a: state.amplitude,
        w: state.frequency
      }) * state.amplitude;
      return Number.isFinite(result) && Math.abs(result) < 1e6 ? result : NaN;
    } catch (_) { return NaN; }
  }

  function setEquation(raw) {
    try {
      const compiled = compileEquation(raw);
      // Probe several points so basic mistakes show immediately.
      compiled.fn({ x: 0.7, t: 0.4, a: 1, w: 1 });
      state.compiled = compiled;
      state.equation = raw.trim();
      errorMessage.textContent = "";
      equationInput.setAttribute("aria-invalid", "false");
      graphLabel.textContent = `y = ${state.equation}`;
      legendEquation.textContent = `f(x, t) = ${state.equation}`;
      applyBtn.disabled = false;
      document.querySelectorAll(".preset").forEach(button => {
        button.classList.toggle("active", button.dataset.equation === state.equation);
      });
    } catch (error) {
      errorMessage.textContent = error.message;
      equationInput.setAttribute("aria-invalid", "true");
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGrid(width, height, originX, originY, scale) {
    if (state.showGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#17231f";
      const step = scale;
      const startX = originX % step;
      const startY = originY % step;
      ctx.beginPath();
      for (let x = startX; x < width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
      for (let y = startY; y < height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
      ctx.stroke();
    }
    if (axesToggle.checked) {
      ctx.strokeStyle = "#405047";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, originY); ctx.lineTo(width, originY);
      ctx.moveTo(originX, 0); ctx.lineTo(originX, height);
      ctx.stroke();
      ctx.fillStyle = "#718278";
      ctx.font = "10px 'DM Mono', monospace";
      ctx.fillText("x", width - 15, Math.max(13, originY - 8));
      ctx.fillText("y", Math.min(width - 14, originX + 8), 13);
      ctx.fillStyle = "#56665b";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let x = Math.ceil(-originX / scale); x <= Math.floor((width-originX)/scale); x++) {
        if (x !== 0) ctx.fillText(String(x), originX + x*scale, originY + 6);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      for (let y = Math.ceil(-originY / scale); y <= Math.floor((height-originY)/scale); y++) {
        if (y !== 0) ctx.fillText(String(-y), originX + 7, originY + y*scale + 3);
      }
    }
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, Math.max(width,height)*0.7);
    bg.addColorStop(0, "#0d1716");
    bg.addColorStop(1, "#080d13");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const scale = Math.max(26, Math.min(44, width / 19));
    const originX = width / 2;
    const originY = height / 2;
    drawGrid(width, height, originX, originY, scale);

    const maxX = width / scale / 2;
    const reveal = drawToggle.checked ? ((state.time * 0.8) % 1) : 1;
    const xEnd = -maxX + 2*maxX*reveal;
    const samples = Math.max(350, Math.floor(width * 2));
    const xStart = -maxX;
    const step = (xEnd - xStart) / samples;

    function plotPath() {
      ctx.beginPath();
      let drawing = false;
      let current = null;
      for (let i = 0; i <= samples; i++) {
        const x = xStart + i*step;
        const y = safeEvaluate(x, state.time);
        const px = originX + x*scale;
        const py = originY - y*scale;
        if (!Number.isFinite(y) || Math.abs(py) > height*5) { drawing = false; continue; }
        if (!drawing) { ctx.moveTo(px, py); drawing = true; }
        else ctx.lineTo(px, py);
        current = {x, y, px, py};
      }
      return current;
    }

    if (glowToggle.checked) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#b8f36b";
      ctx.lineWidth = 7;
      ctx.globalAlpha = .12;
      ctx.shadowColor = "#b8f36b";
      ctx.shadowBlur = 18;
      plotPath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#c6ff83";
    ctx.lineWidth = 2;
    ctx.shadowColor = glowToggle.checked ? "#b8f36b" : "transparent";
    ctx.shadowBlur = glowToggle.checked ? 7 : 0;
    const endpoint = plotPath();
    ctx.stroke();
    ctx.restore();

    if (pointToggle.checked && endpoint && Number.isFinite(endpoint.y)) {
      ctx.beginPath();
      ctx.arc(endpoint.px, endpoint.py, 4, 0, Math.PI*2);
      ctx.fillStyle = "#e7ffcb";
      ctx.shadowColor = "#b8f36b";
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(endpoint.px, endpoint.py, 7, 0, Math.PI*2);
      ctx.strokeStyle = "#b8f36b66";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (state.mouse) {
      const x = (state.mouse.x - originX) / scale;
      const y = safeEvaluate(x, state.time);
      if (Number.isFinite(y)) {
        coordinateReadout.textContent = `x: ${x.toFixed(2)}  y: ${y.toFixed(2)}`;
      }
    } else {
      const y0 = safeEvaluate(0, state.time);
      coordinateReadout.textContent = `x: 0.00  y: ${Number.isFinite(y0) ? y0.toFixed(2) : "undefined"}`;
    }
  }

  function frame(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    const delta = Math.min((timestamp - state.lastTime) / 1000, 0.05);
    state.lastTime = timestamp;
    if (state.running) state.time += delta;
    render();
    requestAnimationFrame(frame);
  }

  function updatePlayButton() {
    playIcon.textContent = state.running ? "Ⅱ" : "▶";
    playText.textContent = state.running ? "Pause" : "Play";
    playBtn.setAttribute("aria-label", state.running ? "Pause animation" : "Play animation");
  }

  applyBtn.addEventListener("click", () => setEquation(equationInput.value));
  equationInput.addEventListener("keydown", event => {
    if (event.key === "Enter") setEquation(equationInput.value);
  });
  playBtn.addEventListener("click", () => {
    state.running = !state.running;
    updatePlayButton();
  });
  resetBtn.addEventListener("click", () => { state.time = 0; render(); });
  speedRange.addEventListener("input", () => {
    state.speed = Number(speedRange.value);
    speedValue.textContent = `${state.speed.toFixed(1)}×`;
  });
  amplitudeRange.addEventListener("input", () => {
    state.amplitude = Number(amplitudeRange.value);
    amplitudeValue.textContent = state.amplitude.toFixed(1);
  });
  frequencyRange.addEventListener("input", () => {
    state.frequency = Number(frequencyRange.value);
    frequencyValue.textContent = state.frequency.toFixed(1);
  });
  gridToggle.addEventListener("click", () => {
    state.showGrid = !state.showGrid;
    gridToggle.setAttribute("aria-pressed", String(state.showGrid));
  });
  document.querySelectorAll(".preset").forEach(button => {
    button.addEventListener("click", () => {
      equationInput.value = button.dataset.equation;
      setEquation(button.dataset.equation);
      graphLabel.textContent = button.dataset.name;
    });
  });
  canvas.addEventListener("mousemove", event => {
    const rect = canvas.getBoundingClientRect();
    state.mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  canvas.addEventListener("mouseleave", () => { state.mouse = null; });
  window.addEventListener("resize", resizeCanvas);

  setEquation(state.equation);
  updatePlayButton();
  resizeCanvas();
  requestAnimationFrame(frame);
})();
