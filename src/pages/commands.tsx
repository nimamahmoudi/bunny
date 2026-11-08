import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import regexCommandsData from "@/lib/regexCommands.json";

type RegexCommandRaw = {
  pattern: string;
  targetTemplate: string;
  description: string;
};

type Command = {
  name: string;
  tokens: string[];
  takesQuery: boolean;
  description: string;
};

const SEARCH_NAMES = new Set([
  "GoogleSearch",
  "YouTubeSearch",
  "RedditSearch",
  "TwitterSearch",
  "FacebookSearch",
  "GitHubSearch",
  "GitHubDirect",
  "PerPlexityAI",
  "ChatGpt",
  "Claude",
  "OpenWebUi",
  "MuseSearch",
]);

const FINANCE_NAMES = new Set([
  "GoogleFinanceSearch",
  "YahooFinance",
  "MetaStock",
  "TELUSStock",
]);

function parseCommands(): Command[] {
  const commands: Command[] = [
    {
      name: "ListCommands",
      tokens: ["ls", "list"],
      takesQuery: false,
      description: "Show this visual list of all commands.",
    },
  ];
  for (const [name, cmd] of Object.entries(
    regexCommandsData
  ) as [string, RegexCommandRaw][]) {
    if (name === "DEFAULT") continue;
    const firstGroup = cmd.pattern.match(/\(([^)]+)\)/);
    if (!firstGroup?.[1]) continue;
    const tokens = firstGroup[1]
      .split("|")
      .map((t) =>
        t.replace(/\\b/g, "").replace(/\\\$/g, "$").replace(/^\\/, "").trim()
      )
      .filter((t) => t.length > 0);
    if (tokens.length === 0) continue;
    commands.push({
      name,
      tokens,
      takesQuery: cmd.pattern.includes("\\s"),
      description: cmd.description,
    });
  }
  return commands;
}

const ALL_COMMANDS = parseCommands();

function commandGroup(name: string): string {
  if (SEARCH_NAMES.has(name)) return "Search";
  if (FINANCE_NAMES.has(name)) return "Finance";
  return "Open";
}

function CommandCard({ cmd }: { cmd: Command }) {
  const firstToken = cmd.tokens[0] ?? "";
  const example = cmd.takesQuery ? `${firstToken} …` : firstToken;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap gap-2">
        {cmd.tokens.map((token) => (
          <span
            key={token}
            className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-sm font-semibold"
          >
            {token}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-white/70">{cmd.description}</p>
      <p className="mt-3 font-mono text-xs text-white/50">{example}</p>
    </div>
  );
}

export default function Commands() {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ALL_COMMANDS;
    return ALL_COMMANDS.filter((cmd) =>
      [cmd.name, cmd.description, ...cmd.tokens]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [filter]);

  const groups = ["Search", "Finance", "Open"] as const;

  return (
    <>
      <Head>
        <title>All commands — Bunny</title>
        <meta
          name="description"
          content="Every Bunny command, in one visual list."
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-[#1e1b4b] via-[#2e026d] to-[#15162c] text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.svg" alt="Bunny logo" className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">
              Bunny
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-white/70">
            <Link href="/commands" className="text-white">
              Commands
            </Link>
            <a
              href="https://github.com/nimamahmoudi/bunny"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub
            </a>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-16">
          <h1 className="pt-6 text-4xl font-bold tracking-tight">
            All commands
          </h1>
          <p className="mt-3 max-w-xl text-white/70">
            Type a shortcut in the address bar or on the homepage, then a
            space and your query. Anything with no shortcut goes to Google
            search.
          </p>

          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            type="text"
            autoComplete="off"
            placeholder="Filter commands… e.g. finance, youtube, github"
            aria-label="Filter commands"
            className="mt-6 w-full max-w-xl rounded-full bg-white px-5 py-3 text-gray-900 shadow-lg outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-white/70"
          />

          {filtered.length === 0 ? (
            <p className="mt-8 text-white/60">
              No commands match “{filter}”.
            </p>
          ) : (
            groups.map((group) => {
              const inGroup = filtered.filter(
                (cmd) => commandGroup(cmd.name) === group
              );
              if (inGroup.length === 0) return null;
              return (
                <section key={group} className="mt-10">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {group}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {inGroup.map((cmd) => (
                      <CommandCard key={cmd.name} cmd={cmd} />
                    ))}
                  </div>
                </section>
              );
            })
          )}

          <p className="mt-10 text-sm text-white/50">
            <Link href="/" className="underline hover:text-white">
              ← Back to search
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
