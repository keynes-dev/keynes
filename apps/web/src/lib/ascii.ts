/**
 * Build-time colorizer for the ASCII diagrams.
 *
 * Mirrors the approach used to draw these diagrams in Figma: run ordered
 * regex rules over each line, later rules overwrite earlier ones, then emit
 * the runs as <span class="c-*"> segments inside a <pre class="ascii">.
 *
 * Pure 7-bit ASCII plus the block ramp (▁▂▃▄▅▆▇█) holds the monospace grid;
 * Unicode box-drawing does not survive font fallback, so we never use it.
 */

export interface Rule {
  re: RegExp;
  cls: string;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (ch) => ESCAPES[ch] ?? ch);
}

/** Colorize `lines` with `rules`; returns HTML for a `<pre class="ascii">`. */
export function paintAscii(lines: string[], rules: Rule[]): string {
  const html: string[] = [];
  for (const line of lines) {
    const classes: (string | null)[] = Array.from(
      { length: line.length },
      () => null,
    );
    for (const rule of rules) {
      const re = new RegExp(
        rule.re.source,
        rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g",
      );
      for (const match of line.matchAll(re)) {
        if (match[0].length === 0) continue;
        const start = match.index ?? 0;
        for (let i = start; i < start + match[0].length; i++)
          classes[i] = rule.cls;
      }
    }
    let out = "";
    let i = 0;
    while (i < line.length) {
      const cls = classes[i];
      let j = i;
      while (j < line.length && classes[j] === cls) j++;
      const chunk = escapeHtml(line.slice(i, j));
      out += cls === null ? chunk : `<span class="${cls}">${chunk}</span>`;
      i = j;
    }
    html.push(out);
  }
  return html.join("\n");
}

export const rep = (ch: string, n: number): string => ch.repeat(Math.max(0, n));

/** Shared chrome/data rules, in ascending priority. */
export const baseRules: Rule[] = [
  { re: /[+|]/, cls: "c-grey" },
  { re: /(?<![a-z>])-+(?![a-z])/, cls: "c-grey" },
  { re: /-+>/, cls: "c-dark" },
  { re: /<-+>/, cls: "c-dark" },
  { re: /[█#]+/, cls: "c-amber" },
  { re: /[░]+|\.{2,}/, cls: "c-blue" },
  { re: /[▓]+|x{2,}/, cls: "c-tomato" },
  { re: /[[\]]/, cls: "c-muted" },
  { re: /\b\d[\d,]*%?\b/, cls: "c-plum" },
  { re: /\[x\] DENIED/, cls: "c-tomato" },
];

export const codeRules: Rule[] = [
  { re: /\b(when|else)\b/, cls: "c-blue" },
  { re: /allow up to/, cls: "c-blue" },
  {
    re: /\b(tokens|toolCalls|retries|escalations|leadScore|context)\b/,
    cls: "c-green",
  },
  { re: /\b\d[\d,]*\b/, cls: "c-plum" },
];
