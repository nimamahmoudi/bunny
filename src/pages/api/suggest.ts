import type { NextApiRequest, NextApiResponse } from "next";
import regexCommandsData from "@/lib/regexCommands.json";
import { toGoogleFinanceSymbol } from "@/lib/googleFinance";
import { evaluateCalc, type CalcResult } from "@/lib/calc";

/**
 * Autocomplete for Bunny.
 *
 * GET /api/suggest?q=...
 * Returns OpenSearch suggestions JSON: [query, [suggestion, ...]]
 *
 * This is what Chrome / Firefox ask for as you type, once Bunny is
 * registered via /opensearch.xml. The homepage search box uses the
 * same endpoint.
 *
 * Per-command suggestions, not just Google for everything:
 * - plain query, or `g` / `goog` -> Google Suggest. (`google` is
 *   deliberately not a command any more: typing "google sheets"
 *   used to drop the word "google" and search for just "sheets".)
 * - `yt` -> YouTube suggestions (Google Suggest with ds=yt)
 * - `gh` / `github` -> GitHub repo search (full names, e.g. facebook/react)
 * - `yf` / `fin` -> Yahoo Finance symbol search (e.g. META, AAPL)
 * - `gf` / `gfin` -> Google Finance symbols (e.g. META:NASDAQ,
 *   XEQT:TSE), converted from Yahoo's symbol search — Google Finance
 *   has no public suggest API (client=finance returns 400, ds=fin
 *   returns nothing), and its quote pages need "<TICKER>:<EXCHANGE>":
 *   a bare "META" or a Yahoo-style "XEQT.TO" shows a generic page.
 *   See src/lib/googleFinance.ts for the conversion.
 * - everything else (`fb`, `r`, `tw`, `ww`, `qq`, `cc`, `aa`) -> Google
 *   as a fallback. Those platforms have no public, unauthenticated
 *   suggest API: X's typeahead returns 403 without auth, Reddit
 *   blocks datacenter IPs, Facebook has none. No keys are used
 *   anywhere here — this is a public repo, so a provider that needs
 *   a key is not an option.
 *
 * Command-aware: if the query starts with a known Bunny command that
 * takes a query (e.g. `g weather tor`, `yt cats`), suggestions are
 * fetched for the part after the command and the command prefix is
 * put back on (`g weather toronto`, `yt cats meowing`). Typing just
 * `g` / `yt` offers the matching commands themselves.
 *
 * Google fallback: a query that looks like a command is often really
 * a Google search, so a `g …` option is always within reach:
 * - a command that takes a query (e.g. `yt cats`) gets
 *   `g <everything typed>` as the second suggestion, after the
 *   first suggestion from that command's own provider. `g` / `goog`
 *   themselves are already Google, so they get no fallback.
 * - a command that takes NO query, with extra text after it (e.g.
 *   `ws protocol` — only a bare `ws` opens Wealthsimple), is very
 *   likely a Google search for the whole thing: `g <everything
 *   typed>` goes first, followed by Google's suggestions for it
 *   (all `g …`), with the landing command itself last so it stays
 *   reachable.
 *
 * Calculator: a plain arithmetic expression (e.g. `100*.02`) is
 * still a Google search by default — the first suggestion is
 * `g <expression>`, and pressing Enter with nothing picked searches
 * Google too. The second suggestion is the built-in calculator
 * (`calc <expression> = <result>`); picking it opens /calc and
 * copies the answer to the clipboard. Typing the calculator
 * explicitly (`calc 100*.02`) flips the order: the `calc …` answer
 * goes first, then the Google search. See src/lib/calc.ts.
 */

type RegexCommandRaw = {
  pattern: string;
  targetTemplate: string;
  description: string;
};

// Extract the command tokens (first capture group) from each pattern in
// regexCommands.json, e.g. "^(g|goog|google)\\s(.*)$" -> g, goog, google.
// A command takes a query when its pattern expects whitespace after it.
const commandTokens = new Map<string, { takesQuery: boolean }>();
for (const cmd of Object.values(regexCommandsData) as RegexCommandRaw[]) {
  const firstGroup = cmd.pattern.match(/\(([^)]+)\)/);
  if (!firstGroup?.[1]) continue;
  const takesQuery = cmd.pattern.includes("\\s");
  for (const rawToken of firstGroup[1].split("|")) {
    const token = rawToken
      .replace(/\\b/g, "")
      .replace(/\\\$/g, "$")
      .replace(/^\\/, "")
      .trim();
    if (!token) continue;
    const existing = commandTokens.get(token.toLowerCase());
    if (!existing || takesQuery) {
      commandTokens.set(token.toLowerCase(), { takesQuery });
    }
  }
}

// Which provider serves each query-taking command. Anything not listed
// here falls back to Google (see the header comment for why).
type SuggestProvider = "google" | "youtube" | "github" | "yahoo" | "googlefinance";
const suggestProviders: Record<string, SuggestProvider> = {
  g: "google",
  goog: "google",
  yt: "youtube",
  gh: "github",
  github: "github",
  yf: "yahoo",
  fin: "yahoo",
  gf: "googlefinance",
  gfin: "googlefinance",
};

async function fetchGoogleSuggestions(
  query: string,
  ds?: string
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const url =
      "https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=ca&q=" +
      encodeURIComponent(query) +
      (ds ? `&ds=${ds}` : "");
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Bunny)" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, unknown];
    if (!Array.isArray(data)) return [];
    const suggestions = data[1];
    if (!Array.isArray(suggestions)) return [];
    return suggestions
      .filter((s): s is string => typeof s === "string")
      .slice(0, 8);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// GitHub repo search, unauthenticated, no key. Returns repo full names
// ("facebook/react"). Returns null on failure / rate limit so the
// caller can fall back to Google instead of showing nothing.
async function fetchGitHubSuggestions(
  query: string
): Promise<string[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      "https://api.github.com/search/repositories?q=" +
        encodeURIComponent(query) +
        "&per_page=5",
      {
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Bunny",
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { full_name?: string }[];
    };
    const names = (data.items ?? [])
      .map((item) => item.full_name)
      .filter((name): name is string => typeof name === "string");
    return names.slice(0, 5);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Yahoo Finance symbol search, no key. Returns the raw quotes
// (symbol, exchange, quote type) so callers can use them as Yahoo
// symbols (yf) or convert them to Google Finance symbols (gf).
// Returns null on failure / rate limit so the caller can fall back
// to Google instead of showing nothing.
type YahooQuote = {
  symbol?: string;
  exchange?: string;
  quoteType?: string;
};

async function fetchYahooFinanceQuotes(
  query: string
): Promise<YahooQuote[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      "https://query2.finance.yahoo.com/v1/finance/search?q=" +
        encodeURIComponent(query) +
        "&quotesCount=5&newsCount=0",
      {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Bunny)" },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      quotes?: YahooQuote[];
    };
    return data.quotes ?? [];
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Yahoo Finance symbol search, no key. Returns ticker symbols ("META").
async function fetchYahooFinanceSuggestions(
  query: string
): Promise<string[] | null> {
  const quotes = await fetchYahooFinanceQuotes(query);
  if (quotes === null) return null;
  const symbols = [...new Set(
    quotes
      .map((quote) => quote.symbol)
      .filter((symbol): symbol is string => typeof symbol === "string")
  )];
  return symbols.slice(0, 5);
}

// Google Finance symbol search, via Yahoo's symbol search converted
// to Google format ("META:NASDAQ", "XEQT:TSE"). Futures, currencies
// and indices have no Google Finance quote form and are skipped.
async function fetchGoogleFinanceSuggestions(
  query: string
): Promise<string[] | null> {
  const quotes = await fetchYahooFinanceQuotes(query);
  if (quotes === null) return null;
  const symbols = [...new Set(
    quotes
      .filter(
        (quote) =>
          quote.quoteType === "EQUITY" || quote.quoteType === "ETF"
      )
      .map((quote) =>
        quote.symbol
          ? toGoogleFinanceSymbol(quote.symbol, quote.exchange)
          : null
      )
      .filter((symbol): symbol is string => symbol !== null)
  )];
  return symbols.slice(0, 5);
}

// Suggestions for a calculation. The Google search for the
// expression and the calculator answer are always the first two,
// in an order that depends on how the calculator was reached:
// - bare expression ("100*.02"): Google first, calculator second
//   (Enter with nothing picked searches Google too).
// - explicit "calc <expression>": calculator first, Google second.
// The rest are Google's own suggestions for the expression.
async function calcSuggestions(
  calc: CalcResult,
  answerFirst: boolean
): Promise<string[]> {
  const answer = `calc ${calc.expression} = ${calc.formatted}`;
  const google = `g ${calc.expression}`;
  const out = answerFirst ? [answer, google] : [google, answer];
  const googleSuggestions = await fetchGoogleSuggestions(calc.expression);
  for (const s of googleSuggestions) {
    // Google Suggest completes an expression with "= <result>"
    // ("= 2"); the answer is already in the list, so those add
    // nothing but noise.
    if (s.trim().startsWith("=")) continue;
    const candidate = `g ${s}`;
    if (candidate !== google && !out.includes(candidate)) {
      out.push(candidate);
    }
    if (out.length >= 8) break;
  }
  return out;
}

async function fetchSuggestionsForCommand(
  token: string,
  rest: string
): Promise<string[]> {
  const provider = suggestProviders[token.toLowerCase()] ?? "google";
  if (provider === "youtube") {
    return fetchGoogleSuggestions(rest, "yt");
  }
  if (provider === "github") {
    const repos = await fetchGitHubSuggestions(rest);
    if (repos !== null) return repos;
    return fetchGoogleSuggestions(rest);
  }
  if (provider === "yahoo") {
    const symbols = await fetchYahooFinanceSuggestions(rest);
    if (symbols !== null) return symbols;
    return fetchGoogleSuggestions(rest);
  }
  if (provider === "googlefinance") {
    const symbols = await fetchGoogleFinanceSuggestions(rest);
    if (symbols !== null) return symbols;
    return fetchGoogleSuggestions(rest);
  }
  return fetchGoogleSuggestions(rest);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const raw = req.query.q;
  const q = Array.isArray(raw) ? raw.join(" ") : raw ?? "";
  if (!q.trim()) {
    return res.status(200).json(["", []]);
  }

  // Never fail the omnibox: a provider error means "no suggestions",
  // not a 500.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

  const trimmed = q.trimStart();

  // "calc <expression>": the calculator was asked for explicitly,
  // so its answer goes first, then the Google search.
  const explicitCalc = trimmed.match(/^calc\s+(.+)$/i);
  const explicitRest = explicitCalc?.[1];
  if (explicitRest) {
    const calc = evaluateCalc(explicitRest);
    if (calc) {
      return res
        .status(200)
        .json([q, await calcSuggestions(calc, true)]);
    }
    // Not a calculation (e.g. "calc taxes"): fall through to the
    // normal Google suggestions below.
  }

  // Calculator: a bare expression (e.g. "100*.02"). The Google
  // search goes first — Enter with nothing picked searches Google
  // too — and the built-in calculator ("calc …", which opens /calc
  // and copies the answer) is the second suggestion.
  const calc = evaluateCalc(trimmed);
  if (calc) {
    return res.status(200).json([q, await calcSuggestions(calc, false)]);
  }

  const spaceIndex = trimmed.search(/\s/);

  // No space yet: offer matching command names, e.g. "g" -> "g ", "goog ".
  // Query-taking commands get a trailing space so you can keep typing;
  // landing commands (e.g. "gm") are offered as-is.
  if (spaceIndex === -1) {
    const lower = trimmed.toLowerCase();
    const matches = [...commandTokens.entries()]
      .filter(([token]) => token.startsWith(lower))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 8)
      .map(([token, info]) => (info.takesQuery ? `${token} ` : token));
    if (matches.length > 0) {
      return res.status(200).json([q, matches]);
    }
    const suggestions = await fetchGoogleSuggestions(trimmed);
    return res.status(200).json([q, suggestions]);
  }

  // "<command> <rest>": suggest for <rest> from that command's
  // provider, put the command back on.
  const first = trimmed.slice(0, spaceIndex);
  const rest = trimmed.slice(spaceIndex).trim();
  const command = commandTokens.get(first.toLowerCase());
  if (command?.takesQuery && rest) {
    const suggestions = await fetchSuggestionsForCommand(first, rest);
    const prefixed = suggestions.map((s) => `${first} ${s}`);
    // Second option: Google-search the whole thing as typed, in
    // case the command-looking input was really a Google search.
    // `g` / `goog` are already Google, so they get no fallback.
    const tokenLower = first.toLowerCase();
    if (tokenLower !== "g" && tokenLower !== "goog") {
      const fallback = `g ${trimmed}`;
      if (!prefixed.includes(fallback)) {
        prefixed.splice(1, 0, fallback);
      }
    }
    return res.status(200).json([q, prefixed.slice(0, 8)]);
  }

  // "<command> <rest>" where the command takes NO query (e.g. "ws
  // protocol"): the whole thing is very likely a Google search, not
  // the landing page, so the Google search for exactly what was
  // typed goes first, followed by Google's suggestions for it (all
  // "g …"), with the landing command itself last so it stays
  // reachable.
  if (command && rest) {
    const googleSuggestions = await fetchGoogleSuggestions(trimmed);
    const out = [`g ${trimmed}`];
    for (const s of googleSuggestions) {
      const candidate = `g ${s}`;
      if (candidate !== out[0] && !out.includes(candidate)) {
        out.push(candidate);
      }
      if (out.length >= 7) break;
    }
    out.push(first.toLowerCase());
    return res.status(200).json([q, out.slice(0, 8)]);
  }

  const suggestions = await fetchGoogleSuggestions(trimmed);
  return res.status(200).json([q, suggestions]);
}
