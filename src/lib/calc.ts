// Built-in calculator for Bunny.
//
// Typing a plain arithmetic expression (e.g. "100*.02") shows the
// answer as the first suggestion and, on Enter, opens /calc with the
// result — no round-trip to Google needed.
//
// Safe by construction: the input is tokenised and evaluated by a
// small recursive-descent parser. There is no eval() / Function(),
// and anything that is not plain arithmetic returns null.
//
// Supported: + - * / % ^ ( ) and decimal numbers. "x" / "×" mean
// multiply, "÷" means divide, "**" means power. "%" is a postfix
// percent (50% = 0.5, so 200*15% = 30). "^" is power,
// right-associative. A date like 2026-11-08 is NOT a calculation,
// and neither is a bare number like 42.

export type CalcResult = {
  // Cleaned-up expression, e.g. "100*.02" (whitespace collapsed,
  // any "= ..." suffix removed).
  expression: string;
  value: number;
  // Rounded to 12 significant digits so float noise like
  // 100*0.02 = 2.0000000000000004 displays as 2.
  formatted: string;
};

const MAX_EXPRESSION_LENGTH = 100;

// A date, with or without spaces: 2026-11-08, 2026 - 11 - 08.
const DATE_LIKE = /^\d{4}-\d{1,2}-\d{1,2}$/;
// Just a (possibly signed, possibly parenthesised) number: not a
// calculation, e.g. "42", "-5", "(42)".
const LONE_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

export function formatCalcValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toPrecision(12));
  if (!Number.isFinite(rounded)) return "";
  return String(rounded);
}

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" | "%" | "(" | ")" };

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    // charAt (not [i]) so the type stays string under
    // noUncheckedIndexedAccess.
    const ch = text.charAt(i);
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch >= "0" && ch <= "9" || ch === ".") {
      let j = i;
      let dots = 0;
      while (j < text.length && ((text.charAt(j) >= "0" && text.charAt(j) <= "9") || text.charAt(j) === ".")) {
        if (text.charAt(j) === ".") dots++;
        j++;
      }
      const raw = text.slice(i, j);
      if (dots > 1 || !/\d/.test(raw)) return null;
      tokens.push({ type: "num", value: parseFloat(raw) });
      i = j;
      continue;
    }
    if (
      ch === "+" ||
      ch === "-" ||
      ch === "*" ||
      ch === "/" ||
      ch === "^" ||
      ch === "%" ||
      ch === "(" ||
      ch === ")"
    ) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    return null;
  }
  return tokens;
}

// Grammar:
//   expr   := term (("+" | "-") term)*
//   term   := power (("*" | "/") power)*
//   power  := unary ("^" power)?            (right-associative)
//   unary  := ("+" | "-") unary | postfix
//   postfix:= primary ("%" )*               (% is postfix percent)
//   primary:= number | "(" expr ")"
function parseTokens(tokens: Token[]): number | null {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function parseExpr(): number | null {
    let value = parseTerm();
    if (value === null) return null;
    while (peek()?.type === "op") {
      const op = (peek() as { type: "op"; value: string }).value;
      if (op !== "+" && op !== "-") break;
      pos++;
      const rhs = parseTerm();
      if (rhs === null) return null;
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number | null {
    let value = parsePower();
    if (value === null) return null;
    while (peek()?.type === "op") {
      const op = (peek() as { type: "op"; value: string }).value;
      if (op !== "*" && op !== "/") break;
      pos++;
      const rhs = parsePower();
      if (rhs === null) return null;
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parsePower(): number | null {
    const base = parseUnary();
    if (base === null) return null;
    if (peek()?.type === "op" && (peek() as { type: "op"; value: string }).value === "^") {
      pos++;
      const exp = parsePower();
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number | null {
    const token = peek();
    if (token?.type === "op" && (token.value === "+" || token.value === "-")) {
      pos++;
      const value = parseUnary();
      if (value === null) return null;
      return token.value === "-" ? -value : value;
    }
    return parsePostfix();
  }

  function parsePostfix(): number | null {
    let value = parsePrimary();
    if (value === null) return null;
    while (peek()?.type === "op" && (peek() as { type: "op"; value: string }).value === "%") {
      pos++;
      value = value / 100;
    }
    return value;
  }

  function parsePrimary(): number | null {
    const token = peek();
    if (!token) return null;
    if (token.type === "num") {
      pos++;
      return token.value;
    }
    if (token.type === "op" && token.value === "(") {
      pos++;
      const value = parseExpr();
      if (value === null) return null;
      const close = peek();
      if (!close || close.type !== "op" || close.value !== ")") return null;
      pos++;
      return value;
    }
    return null;
  }

  const value = parseExpr();
  if (value === null || pos !== tokens.length) return null;
  return value;
}

/**
 * Evaluate `input` as an arithmetic expression. Returns null when
 * it is not one. A trailing "= ..." (as in a picked
 * "100*.02 = 2" suggestion) is ignored — only the part before the
 * "=" is evaluated.
 */
export function evaluateCalc(input: string): CalcResult | null {
  let text = input.trim();
  if (!text || text.length > MAX_EXPRESSION_LENGTH + 20) return null;

  // A picked "<expr> = <result>" suggestion: evaluate the left side.
  const eqIndex = text.indexOf("=");
  if (eqIndex !== -1) {
    text = text.slice(0, eqIndex).trim();
    if (!text) return null;
  }

  // Normalise display variants to plain operators. The returned
  // expression keeps the user's own characters (e.g. "×") out —
  // it is the normalised form, so /calc and /api/search agree on it.
  text = text
    .replace(/[−–—]/g, "-")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/\*\*/g, "^")
    // "2x3", "2 x 3", "(2)x(3)" -> multiply.
    .replace(/(?<=[0-9.)])\s*[xX]\s*(?=[0-9.(])/g, "*")
    // Thousand separators: 1,000 -> 1000.
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > MAX_EXPRESSION_LENGTH) return null;

  // Dates are not calculations.
  if (DATE_LIKE.test(text.replace(/\s+/g, ""))) return null;
  // A bare number is not a calculation.
  if (LONE_NUMBER.test(text.replace(/[()\s]/g, ""))) return null;
  // Only arithmetic characters, at least one digit, at least one
  // operator (or parenthesis / percent).
  if (!/^[0-9+\-*/%^().\s]+$/.test(text)) return null;
  if (!/\d/.test(text)) return null;
  if (!/[*\/\%\^+\-()]/.test(text)) return null;

  const tokens = tokenize(text);
  if (tokens === null || tokens.length === 0) return null;
  const value = parseTokens(tokens);
  if (value === null || !Number.isFinite(value)) return null;

  const formatted = formatCalcValue(value);
  if (!formatted) return null;
  return { expression: text, value, formatted };
}
