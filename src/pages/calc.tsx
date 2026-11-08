import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { evaluateCalc } from "@/lib/calc";
import { copyTextToClipboard } from "@/lib/clipboard";

// Built-in calculator result page.
//
// Reached from /api/search for "calc <expression>" (or a picked
// "calc <expr> = <result>" suggestion), or directly as
// /calc?expr=100*.02. The answer is evaluated locally (see
// src/lib/calc.ts) — no round-trip to Google. With ?copy=1 the
// answer is copied to the clipboard on arrival, so you can paste
// it straight away.
//
// Browsers only let a page write to the clipboard during a user
// gesture (a click or keypress), so the on-arrival copy may be
// blocked when the page opens without one. When that happens the
// page says so, offers a Copy button, and retries on your first
// click or keypress here. A bare calculation with no "calc" prefix
// never reaches this page — typing "100*.02" and pressing Enter
// searches Google instead.
export default function Calc() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const copyDone = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copyRequested = router.query.copy === "1";
  const calc = evaluateCalc(input);
  const result = calc?.formatted ?? "";
  const trimmed = input.trim();

  const copyResult = useCallback(async (text: string) => {
    if (!text) return false;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      copyDone.current = true;
      setCopyState("copied");
    } else {
      setCopyState("failed");
    }
    return ok;
  }, []);

  // Deep link: /calc?expr=100*.02 fills the box on arrival.
  useEffect(() => {
    if (!router.isReady) return;
    const expr = router.query.expr;
    const value = Array.isArray(expr) ? expr.join(" ") : expr ?? "";
    if (value && !input) {
      setInput(value);
    }
    // Only fill from the URL once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Copy the answer on arrival when asked (?copy=1). This works
  // when the browser carries the click / Enter gesture across the
  // navigation; when it does not, copyState becomes "failed" and
  // the retry + button below take over.
  useEffect(() => {
    if (copyRequested && result && !copyDone.current) {
      void copyResult(result);
    }
  }, [copyRequested, result, copyResult]);

  // If the on-arrival copy was blocked, retry on the first click
  // or keypress on the page — that is a gesture, so the copy
  // is allowed then.
  useEffect(() => {
    if (!copyRequested) return;
    const retry = () => {
      if (result && !copyDone.current) void copyResult(result);
    };
    window.addEventListener("pointerdown", retry);
    window.addEventListener("keydown", retry);
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [copyRequested, result, copyResult]);

  const go = (value: string) => {
    const text = value.trim();
    if (!text) return;
    const calcMatch = text.match(/^calc\s+(.+)$/i);
    const calcRest = calcMatch?.[1];
    const next = calcRest ? evaluateCalc(calcRest) : null;
    if (next) {
      // In this keypress / click gesture, so the copy is allowed.
      void copyResult(next.formatted);
      void router.push(
        `/calc?expr=${encodeURIComponent(next.expression)}&copy=1`
      );
    } else {
      // Anything else — including a bare calculation — goes to
      // /api/search, which searches Google for it.
      window.location.href = `/api/search?q=${encodeURIComponent(text)}`;
    }
  };

  return (
    <>
      <Head>
        <title>
          {calc ? `${calc.expression} = ${calc.formatted} — Bunny` : "Calculator — Bunny"}
        </title>
        <meta
          name="description"
          content="Bunny's built-in calculator — type calc 100*.02 and the answer is copied to your clipboard."
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
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Calculator
          </h1>

          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              go(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Try calc 100*.02"
              aria-label="Calculation"
              className="w-full rounded-full bg-white py-4 px-6 text-center font-mono text-lg text-gray-900 shadow-xl outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-white/70"
            />
          </form>

          {calc ? (
            <div className="mt-10">
              <p className="font-mono text-lg text-white/70">
                {calc.expression} =
              </p>
              <p className="mt-2 break-words text-6xl font-bold tracking-tight">
                {calc.formatted}
              </p>
              <div className="mt-6 flex flex-col items-center gap-3">
                {copyRequested && copyState === "copied" && (
                  <p className="text-sm text-emerald-300">
                    Copied {calc.formatted} to your clipboard — just paste
                    it.
                  </p>
                )}
                {copyRequested && copyState === "failed" && (
                  <p className="text-sm text-amber-300">
                    Your browser blocked the automatic copy — tap Copy
                    below, or just press any key.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void copyResult(calc.formatted)}
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 shadow hover:bg-gray-100"
                >
                  {copyState === "copied" ? "Copied ✓" : "Copy result"}
                </button>
              </div>
              <p className="mt-8 text-sm text-white/50">
                <a
                  href={`https://google.com/search?q=${encodeURIComponent(
                    calc.expression
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-white"
                >
                  Search Google for {calc.expression}
                </a>
              </p>
            </div>
          ) : (
            <p className="mt-10 text-white/60">
              {trimmed
                ? "That does not look like a calculation — press Enter to search for it instead."
                : "Type a calculation, e.g. calc 100*.02, (250 + 40) / 3, or calc 200*15%."}
            </p>
          )}

          <p className="mt-10 text-sm text-white/50">
            Supports + − * / % ^ and parentheses. % is a percent
            (50% = 0.5, so 200*15% = 30). A bare calculation searches
            Google — put calc in front of it to calculate here and
            copy the answer.{" "}
            <Link href="/" className="underline hover:text-white">
              ← Back to search
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
