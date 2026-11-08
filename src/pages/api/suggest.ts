import type { NextApiRequest, NextApiResponse } from "next";
import regexCommandsData from "@/lib/regexCommands.json";

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
 * Source: Google Suggest (client=firefox, no API key). Bunny's default
 * search already redirects to Google, so this sends keystrokes to the
 * same place a plain Google search would — no new provider.
 *
 * Command-aware: if the query starts with a known Bunny command that
 * takes a query (e.g. `g weather tor`, `yt cats`), suggestions are
 * fetched for the part after the command and the command prefix is
 * put back on (`g weather toronto`). Typing just `g` / `yt` offers
 * the matching commands themselves.
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

async function fetchGoogleSuggestions(query: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const url =
      "https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=ca&q=" +
      encodeURIComponent(query);
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

  // "<command> <rest>": suggest for <rest>, put the command back on.
  const first = trimmed.slice(0, spaceIndex);
  const rest = trimmed.slice(spaceIndex).trim();
  const command = commandTokens.get(first.toLowerCase());
  if (command?.takesQuery && rest) {
    const suggestions = await fetchGoogleSuggestions(rest);
    return res.status(200).json([
      q,
      suggestions.map((s) => `${first} ${s}`),
    ]);
  }

  const suggestions = await fetchGoogleSuggestions(trimmed);
  return res.status(200).json([q, suggestions]);
}
