/**
 * ASCII figures for the landing page (policy snippets and deployment glyphs).
 */

import { baseRules, codeRules, paintAscii, rep, type Rule } from "./ascii";

const nameRule = (words: string[], cls = "c-dark"): Rule => ({
  re: new RegExp(`\\b(${words.join("|").replace(/ /g, "\\ ")})\\b`),
  cls,
});

/* ---------------- hero: Policy / Agent ---------------- */

export const heroPolicy = paintAscii(
  [
    "when leadScore >= 80",
    "  allow up to",
    "    tokens        1,500",
    "    toolCalls         3",
    "else",
    "  allow up to",
    "    tokens        1,000",
    "    toolCalls         2",
  ],
  codeRules,
);

export const heroRequest = paintAscii(
  [
    "tokens              1,500",
    "toolCalls               3",
    "context   leadScore:   84",
  ],
  codeRules,
);

export const heroResponse = paintAscii(
  [
    "status      denied",
    "code        insufficient_resources",
    "resource    tokens",
    "requested   1,500",
    "available   1,000",
  ],
  [
    {
      re: /\b(status|code|resource|requested|available)\b/,
      cls: "c-on-dark-muted",
    },
  ],
);

/* ---------------- deployments: three glyphs ---------------- */

const GLYPH_WIDTH = 44;

function glyphBox(title: string, body: string[]): string[] {
  const inner = GLYPH_WIDTH - 2;
  return [
    "+-- " + title + " " + rep("-", GLYPH_WIDTH - 6 - title.length) + "+",
    ...body.map((line) => "|" + line.padEnd(inner).substring(0, inner) + "|"),
    "+" + rep("-", inner) + "+",
  ];
}

const glyphRules: Rule[] = [
  ...baseRules,
  { re: /\[ [^\]]+ \]/, cls: "c-dark" },
  { re: /keynes\.\*/, cls: "c-green" },
  {
    re: /in-memory · lost on exit|commits or rolls back together|durable · network required|network/,
    cls: "c-muted",
  },
  nameRule([
    "node process",
    "your postgresql 18.6",
    "one transaction",
    "your app",
    "keynes",
  ]),
];

export const localGlyph = paintAscii(
  [
    ...glyphBox("node process", ["", "   [ app ]  <------->  [ sqlite ]", ""]),
    "",
    "   in-memory · lost on exit",
  ],
  glyphRules,
);

const transactionBox = (() => {
  const inner = 38 - 2;
  const title = "one transaction";
  return [
    "+-- " + title + " " + rep("-", 38 - 6 - title.length) + "+",
    "|" + "  [ your row ]      [ keynes.* ]".padEnd(inner) + "|",
    "+" + rep("-", inner) + "+",
  ];
})();

export const embeddedGlyph = paintAscii(
  [
    ...glyphBox(
      "your postgresql 18.6",
      transactionBox.map((line) => "  " + line),
    ),
    "",
    "   commits or rolls back together",
  ],
  glyphRules,
);

export const hostedGlyph = paintAscii(
  [
    "+-- your app ------+  network  +-- keynes -+",
    "|                  |     :     |  service  |",
    "|   remote sdk     |-----:---->|  postgres |",
    "|                  |     :     |           |",
    "+------------------+     :     +-----------+",
    "",
    "   durable · network required",
  ],
  glyphRules,
);
