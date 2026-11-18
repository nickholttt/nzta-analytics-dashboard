// Placeholder drawings for the canvas mockups. Each is an illustration of a shape, not data: the curves are made-up
// smooth lines, the axes carry no numbers and the series are named "Value A", "Value B" and so on.
(function () {
  const S = ["#3049ba", "#ec5a79", "#a37f03", "#872884", "#236e43", "#8b6ec2"];
  const INK3 = "#6b6d73";
  const RULE = "#e2dfd6";
  const W = 400;
  const xs = (n, left, right) => Array.from({ length: n }, (_, i) => left + ((right - left) * i) / (n - 1));
  const pts = (x, y) => x.map((v, i) => `${v.toFixed(1)},${y[i].toFixed(1)}`).join(" ");
  const grid = (h, left, right) =>
    [0.25, 0.5, 0.75].map((f) => `<line x1="${left}" x2="${right}" y1="${10 + (h - 20) * f}" y2="${10 + (h - 20) * f}" stroke="${RULE}"/>`).join("");
  const label = (x, y, text, colour) => `<text x="${x}" y="${y}" font-size="11" fill="${colour}" font-family="IBM Plex Sans Variable, system-ui">${text}</text>`;

  const draw = {
    mix(h) {
      const x = xs(9, 10, 320);
      const bands = [
        [20, 22, 25, 32, 42, 55, 70, 82, 90],
        [45, 44, 42, 40, 38, 36, 33, 30, 28],
        [55, 54, 53, 50, 47, 43, 40, 36, 33],
      ];
      const bottom = h - 10;
      const height = h - 20;
      const scale = height / 160;
      let base = x.map(() => bottom);
      let out = "";
      const tops = [];
      bands.forEach((b, k) => {
        const top = base.map((v, i) => v - b[i] * scale);
        out += `<polygon points="${pts(x, top)} ${pts([...x].reverse(), [...base].reverse())}" fill="${S[k]}" fill-opacity="0.85"/>`;
        tops.push([top, base]);
        base = top;
      });
      out += `<polygon points="${pts(x, x.map(() => 10))} ${pts([...x].reverse(), [...base].reverse())}" fill="#bdb9ae" fill-opacity="0.7"/>`;
      const names = ["Value A", "Value B", "Value C"];
      tops.forEach(([t, b], k) => (out += label(326, (t[8] + b[8]) / 2 + 4, names[k], S[k])));
      out += label(326, (10 + base[8]) / 2 + 4, "All other", INK3);
      return out;
    },
    trend(h) {
      const x = xs(40, 10, 320);
      const y1 = x.map((_, i) => h - 30 - 60 * (1 - Math.exp(-i / 14)) - 8 * Math.sin(i / 2.2));
      const y2 = x.map((_, i) => h - 40 - 60 * (1 - Math.exp(-i / 14)));
      return (
        grid(h, 10, 320) +
        `<polyline points="${pts(x, y1)}" fill="none" stroke="#bdb9ae" stroke-width="1.2"/>` +
        `<polyline points="${pts(x, y2)}" fill="none" stroke="${S[0]}" stroke-width="2"/>` +
        label(326, y2[39] + 4, "12-month", S[0]) +
        label(326, y2[39] + 17, "rolling", S[0])
      );
    },
    league(h) {
      const lens = [1, 0.82, 0.7, 0.55, 0.46, 0.38, 0.31, 0.25];
      const n = lens.length;
      const row = (h - 10) / n;
      return lens
        .map((f, i) => {
          const y = 5 + i * row;
          return (
            label(0, y + row * 0.62, `Value ${String.fromCharCode(65 + i)}`, "#4b4d53") +
            `<rect x="62" y="${y + row * 0.18}" width="${f * 300}" height="${row * 0.64}" fill="${S[0]}"/>`
          );
        })
        .join("");
    },
    dist(h) {
      const n = 12;
      const bw = 300 / n;
      return Array.from({ length: n }, (_, i) => {
        const f = Math.exp(-((i - 4) ** 2) / 10) * 0.9 + 0.05;
        const bh = f * (h - 30);
        return `<rect x="${12 + i * bw}" y="${h - 15 - bh}" width="${bw - 2}" height="${bh}" fill="${S[0]}"/>`;
      }).join("") + `<line x1="10" x2="315" y1="${h - 15}" y2="${h - 15}" stroke="${INK3}"/>` + label(12, h - 2, "Lowest band", INK3) + label(240, h - 2, "Highest band", INK3);
    },
    matrix(h, hidden) {
      const cols = 4;
      const rows = 5;
      const cw = 70;
      const rh = (h - 30) / rows;
      const steps = ["#e4e6ed", "#c8cde5", "#a8b1dc", "#7c8bd0", "#4057bf", "#263a97"];
      const pattern = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f0eee8"/><line x1="0" y1="0" x2="0" y2="6" stroke="#c9c5ba" stroke-width="2"/></pattern></defs>`;
      let out = pattern;
      for (let c = 0; c < cols; c++) out += label(72 + c * cw + 6, 14, `Value ${c + 1}`, INK3);
      for (let r = 0; r < rows; r++) {
        const y = 22 + r * rh;
        out += label(0, y + rh * 0.62, `Value ${String.fromCharCode(65 + r)}`, "#4b4d53");
        for (let c = 0; c < cols; c++) {
          const k = Math.max(0, 5 - r - c);
          const isHidden = hidden && ((r === 4 && c === 3) || (r === 3 && c === 3) || (r === 4 && c === 2));
          const fill = isHidden ? "url(#hatch)" : steps[k];
          out += `<rect x="${72 + c * cw}" y="${y}" width="${cw - 3}" height="${rh - 3}" fill="${fill}"/>`;
          if (isHidden) out += label(72 + c * cw + 14, y + rh * 0.6, "hidden", INK3);
        }
      }
      return out;
    },
  };

  document.querySelectorAll("[data-illus]").forEach((el) => {
    const kind = el.getAttribute("data-illus");
    const h = Number(el.getAttribute("data-h") || 170);
    const body = draw[kind](h, el.hasAttribute("data-hidden"));
    el.innerHTML =
      `<span class="illus">Illustration, not data</span>` +
      `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="Illustration of a ${kind} chart, not real figures">${body}</svg>`;
  });

  // Small icons for the shape buttons.
  const icons = {
    mix: `<path d="M1 13 L1 8 L5 7 L9 5 L13 4 L13 13 Z" fill="currentColor" opacity=".9"/><path d="M1 8 L5 7 L9 5 L13 4 L13 1 L1 1 Z" fill="currentColor" opacity=".35"/>`,
    trend: `<polyline points="1,12 4,9 7,10 10,5 13,3" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
    league: `<rect x="1" y="1" width="12" height="3" fill="currentColor"/><rect x="1" y="5.5" width="9" height="3" fill="currentColor"/><rect x="1" y="10" width="5" height="3" fill="currentColor"/>`,
    distribution: `<rect x="1" y="8" width="2.5" height="5" fill="currentColor"/><rect x="4" y="4" width="2.5" height="9" fill="currentColor"/><rect x="7" y="2" width="2.5" height="11" fill="currentColor"/><rect x="10" y="7" width="2.5" height="6" fill="currentColor"/>`,
    geo: `<path d="M8 1 L10 4 L9 7 L11 9 L8 13 L6 11 L3 12 L5 8 L4 5 Z" fill="currentColor"/>`,
    matrix: `<rect x="1" y="1" width="5" height="5" fill="currentColor"/><rect x="8" y="1" width="5" height="5" fill="currentColor" opacity=".5"/><rect x="1" y="8" width="5" height="5" fill="currentColor" opacity=".4"/><rect x="8" y="8" width="5" height="5" fill="currentColor" opacity=".8"/>`,
    table: `<rect x="1" y="1" width="12" height="12" fill="none" stroke="currentColor"/><line x1="1" y1="5" x2="13" y2="5" stroke="currentColor"/><line x1="1" y1="9" x2="13" y2="9" stroke="currentColor"/><line x1="6" y1="1" x2="6" y2="13" stroke="currentColor"/>`,
  };
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.insertAdjacentHTML("afterbegin", `<svg viewBox="0 0 14 14" aria-hidden="true">${icons[el.getAttribute("data-icon")]}</svg>`);
  });
})();
