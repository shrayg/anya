import fs from "node:fs";

const path = "styles/landing.css";
let css = fs.readFileSync(path, "utf8");

css = css.replace(
  /:root \{[\s\S]*?--anya-line-soft:[^;]+;\r?\n\}/,
  `.anya-landing, .brutal-page, .marketing-canvas {
  --anya-pink: #c3d3e6;
  --anya-pink-bright: #d8e6f4;
  --anya-black: #050506;
  --anya-ink: #0a0a0b;
  --anya-white: #f4f1f3;
  --anya-dim: #8c898e;
  --anya-line: rgba(244, 241, 243, 0.16);
  --anya-line-soft: rgba(244, 241, 243, 0.08);
}`,
);

css = css.replace(
  /\r?\nhtml \{\r?\n  background: var\(--anya-black\);\r?\n  scroll-behavior: smooth;\r?\n\}\r?\n\r?\nbody \{\r?\n  background: var\(--anya-black\);\r?\n\}\r?\n/,
  "\n",
);

css = css.replace(/(^|[,{\s])(\.home-search[\w-]*)/gm, (match, prefix, selector) => {
  if (match.includes(".anya-landing")) return match;
  return `${prefix}.anya-landing ${selector}`;
});

css = css.replace(/(^|[,{\s])(\.starter-search[\w-]*)/gm, (match, prefix, selector) => {
  if (match.includes(".anya-landing")) return match;
  return `${prefix}.anya-landing ${selector}`;
});

fs.writeFileSync(path, css);
console.log("Scoped landing.css away from classic homepage colors");
