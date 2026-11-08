import Head from "next/head";
import { useEffect, useRef, useState } from "react";

const QUICK_COMMANDS = [
  { token: "g ", label: "Google" },
  { token: "yt ", label: "YouTube" },
  { token: "gh ", label: "GitHub" },
  { token: "r ", label: "Reddit" },
  { token: "tw ", label: "Twitter" },
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
              (data[1] as unknown[]).filter(
                (s): s is string => typeof s === "string"
              ).slice(0, 8)
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
      const chosen =
        active >= 0 ? suggestions[active] : undefined;
      go(chosen ?? query);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <>
      <Head>
        <title>Bunny</title>
        <meta
          name="description"
          content="Bunny — quick commands and search"
        />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="search"
          type="application/opensearchdescription+xml"
          title="Bunny"
          href="/opensearch.xml"
        />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4">
        <div className="w-full max-w-xl">
          <h1 className="mb-2 text-center text-5xl font-bold text-white">
            Bunny
          </h1>
          <p className="mb-6 text-center text-sm text-white/60">
            Type a command or search — try{" "}
            <code className="text-white/80">g weather toronto</code> or{" "}
            <code className="text-white/80">yt cats</code>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(query);
            }}
          >
            <div className="relative">
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
                className="w-full rounded-full bg-white/95 px-5 py-3 text-lg text-gray-900 shadow-lg outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-white/70"
              />
              {open && suggestions.length > 0 && (
                <ul
                  id="suggestions-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl bg-white text-gray-900 shadow-xl"
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
                        className={`block w-full px-5 py-2 text-left ${
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
                onClick={() => {
                  setQuery(cmd.token);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40 hover:text-white"
              >
                {cmd.token.trim()} · {cmd.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => go("ls")}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40 hover:text-white"
            >
              ls · all commands
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
