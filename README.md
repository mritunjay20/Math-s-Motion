# MathMotion

**Turn equations into motion.** MathMotion is a browser-based mathematical visualization project that draws animated functions using HTML Canvas and JavaScript.

## Features

- Live 2D graph plotting
- Interactive equation input
- Play, pause, and reset controls
- Adjustable animation speed, amplitude, and frequency
- Grid and coordinate axes toggles
- Optional glow, moving point, and draw-on animation
- Preset functions for quick experimentation
- Responsive dark interface
- Restricted mathematical expression parser (does not use `eval()`)

## Try it locally

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Enter an equation such as `sin(x - t)` and select **Apply equation**.

No build step, package manager, backend, or API key is required.

## Supported syntax

Operators: `+`, `-`, `*`, `/`, `^`, parentheses  
Variables: `x`, `t`, `a`, `w`  
Constants: `pi`, `e`  
Functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `log`, `log10`, `exp`, `floor`, `ceil`, `round`, `sign`, `sinh`, `cosh`, `tanh`, `min`, `max`, `pow`

Examples:

```text
sin(x - t)
cos(2*x - t)
sin(x)*cos(t)
0.15*x*x*sin(t)
sqrt(abs(x))
sin(x)^2
```

Angles are in radians. The variable `t` changes with animation time. Amplitude and frequency controls also affect the displayed function.

## Deploy on GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`.
5. Save and wait for GitHub Pages to publish the site.

## Project structure

```text
MathMotion/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── README.md
```

## Roadmap

- [ ] Parametric equations (`x(t)`, `y(t)`)
- [ ] Polar curves (`r = f(theta)`)
- [ ] Save and share presets
- [ ] Export frames or animations
- [ ] Optional 3D surface mode

## License
 
