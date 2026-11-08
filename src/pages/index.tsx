import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const QUICK_COMMANDS = [
  { token: "g ", label: "Google" },
  { token: "yt ", label: "YouTube" },
  { token: "gh ", label: "GitHub" },
  { token: "gf ", label: "Google Finance" },
  { token: "yf ", label: "Yahoo Finance" },
  { token: "fin ", label: "Financials" },
  { token: "r ", label: "Reddit" },
  { token: "tw ", label: "Twitter" },
  { token: "muse ", label: "Muse" },
];

const POPULAR_COMMANDS = [
  {
    token: "g",
    name: "Google",
    description: "Search the web.",
    example: "g weather toronto",
  },
  {
    token: "yt",
    name: "YouTube",
    description: "Search videos.",
    example: "yt cats",
  },
  {
    token: "gh",
    name: "GitHub",
    description: "Search repos and code.",
    example: "gh react",
  },
  {
    token: "gf",
    name: "Google Finance",
    description: "Stock quotes on Google Finance.",
    example: "gf META",
  },
  {
    token: "yf",
    name: "Yahoo Finance",
    description: "Stock quotes on Yahoo Finance.",
    example: "yf AAPL",
  },
  {
    token: "fin",
    name: "Yahoo Financials",
    description: "Financials for a stock on Yahoo Finance.",
    example: "fin META",
  },
  {
    token: "tax",
    name: "Tax calculator",
    description: "Wealthsimple income tax calculator (Ontario).",
    example: "tax",
  },
  {
    token: "ci",
    name: "Compound interest",
    description: "SEC compound interest calculator.",
    example: "ci",
  },
  {
    token: "r",
    name: "Reddit",
    description: "Search Reddit.",
    example: "r cats",
  },
  {
    token: "tw",
    name: "Twitter",
    description: "Search X / Twitter.",
    example: "tw cats",
  },
  {
    token: "ww",
    name: "Perplexity",
    description: "Ask Perplexity AI.",
    example: "ww black holes",
  },
  {
    token: "qq",
    name: "ChatGPT",
    description: "Ask ChatGPT.",
    example: "qq black holes",
  },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      setActive(-1);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/suggest?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : ["", []]))
        .then((data: unknown) => {
          if (Array.isArray(data) && Array.isArray(data[1])) {
            setSuggestions(
              (data[1] as unknown[])
                .filter((s): s is string => typeof s === "string")
                .slice(0, 8)
            );
            setOpen(true);
            setActive(-1);
          }
        })
        .catch(() => {
          // No suggestions is fine; typing + Enter still works.
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    window.location.href = `/api/search?q=${encodeURIComponent(trimmed)}`;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setOpen(true);
        setActive((prev) => Math.min(prev + 1, suggestions.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = active >= 0 ? suggestions[active] : undefined;
      go(chosen ?? query);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const pickCommand = (token: string) => {
    setQuery(`${token} `);
    inputRef.current?.focus();
  };

  return (
    <>
      <Head>
        <title>Bunny — shortcuts for search</title>
        <meta
          name="description"
          content="Bunny — type a shortcut and go straight there. Google, YouTube, GitHub, Google Finance and more, with suggestions as you type."
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link
          rel="search"
          type="application/opensearchdescription+xml"
          title="Bunny"
          href="/opensearch.xml"
        />
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
            <Link href="/commands" className="hover:text-white">
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

        <main className="mx-auto max-w-3xl px-6 pb-16 pt-10 text-center md:pt-16">
          <img
            src="/logo.svg"
            alt="Bunny logo"
            className="mx-auto h-20 w-20 drop-shadow-lg"
          />
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            Bunny
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            Type a shortcut, go straight there. Search Google, YouTube,
            GitHub and Google Finance — with suggestions as you type.
          </p>

          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              go(query);
            }}
          >
            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setOpen(true);
                }}
                onBlur={() => {
                  // Delay so a suggestion click lands before we close.
                  setTimeout(() => setOpen(false), 150);
                }}
                type="text"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Search or type a command…"
                aria-label="Search or type a command"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="suggestions-list"
                aria-expanded={open}
                aria-activedescendant={
                  active >= 0 ? `suggestion-${active}` : undefined
                }
                className="w-full rounded-full bg-white py-4 pl-12 pr-16 text-lg text-gray-900 shadow-xl outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-white/70"
              />
              <kbd className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500 sm:block">
                Enter
              </kbd>
              {open && suggestions.length > 0 && (
                <ul
                  id="suggestions-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl bg-white text-left text-gray-900 shadow-xl"
                >
                  {suggestions.map((suggestion, i) => (
                    <li
                      key={suggestion}
                      id={`suggestion-${i}`}
                      role="option"
                      aria-selected={i === active}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          go(suggestion);
                        }}
                        onMouseEnter={() => setActive(i)}
                        className={`block w-full px-5 py-2.5 text-left ${
                          i === active ? "bg-gray-100" : ""
                        }`}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.token}
                type="button"
                onClick={() => pickCommand(cmd.token.trim())}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40 hover:text-white"
              >
                {cmd.token.trim()} · {cmd.label}
              </button>
            ))}
            <Link
              href="/commands"
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40 hover:text-white"
            >
              ls · all commands
            </Link>
          </div>
        </main>

        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              Popular commands
            </h2>
            <Link
              href="/commands"
              className="text-sm text-white/70 hover:text-white"
            >
              See all commands →
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POPULAR_COMMANDS.map((cmd) => (
              <button
                key={cmd.token}
                type="button"
                onClick={() => pickCommand(cmd.token)}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-white/25 hover:bg-white/10"
              >
                <span className="inline-block rounded-full bg-white/10 px-2.5 py-1 font-mono text-sm font-semibold">
                  {cmd.token}
                </span>
                <span className="mt-3 block font-semibold">{cmd.name}</span>
                <span className="mt-1 block text-sm text-white/60">
                  {cmd.description}
                </span>
                <span className="mt-3 block font-mono text-xs text-white/50">
                  {cmd.example}
                </span>
              </button>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-white/50">
          Bunny is open source —{" "}
          <a
            href="https://github.com/nimamahmoudi/bunny"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-white"
          >
            github.com/nimamahmoudi/bunny
          </a>
          . Suggestions come from Google, YouTube, GitHub and Yahoo Finance.
        </footer>
      </div>
    </>
  );
}
