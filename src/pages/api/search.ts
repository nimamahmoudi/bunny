import { NextApiRequest, NextApiResponse } from 'next';
import regexCommandsData from '@/lib/regexCommands.json'; // Adjust the path as necessary
import { toGoogleFinanceSymbol } from '@/lib/googleFinance';
import { evaluateCalc } from '@/lib/calc';

type FunctionCommand = {
  matcher: RegExp;
  // May be async (gf resolves the exchange via Yahoo first) and may
  // return the response object from res.redirect.
  action: (
    req: NextApiRequest,
    res: NextApiResponse,
    matches: RegExpMatchArray
  ) => unknown;
  description: string;
};

type RegexCommandRaw = {
  pattern: string;
  targetTemplate: string;
  description: string;
};

type RegexCommand = {
  name: string;
  matcher: RegExp;
  target: (matches: RegExpMatchArray) => string;
  description: string;
};

const encodeForSearch = (query: string) => {
  return query.replace(/\s/g, '+')
}

// Convert JSON data into usable commands
const regexCommands: RegexCommand[] = Object.entries(regexCommandsData).map(([name, cmd]: [string, RegexCommandRaw]) => ({
  ...cmd,
  name,
  matcher: new RegExp(cmd.pattern),
  target: (matches: RegExpMatchArray) => {
    // Use the captured groups from the regex match to replace placeholders in the targetTemplate
    let target = cmd.targetTemplate;
    matches.forEach((match, index) => {
      // Skip the entire match and the command and start with the first capturing group
      if (index < 2) return;
      const replacement = match ?? '';
      // console.log('replacing', `\$${index - 1}`, '==>', replacement)
      target = target.replace(new RegExp(`\\$${index - 1}`, 'g'), encodeURIComponent(replacement));
    });
    return target;
  },
})).sort( // sort in a way that DEFAULT is always last
  (a: RegexCommand, b: RegexCommand) => {
    if (a.name === "DEFAULT") return 1;
    if (b.name === "DEFAULT") return -1;
    return 0;
  }
);

const functionCommands: FunctionCommand[] = [
  {
    matcher: /^(ls|list)$/,
    action: (req, res) => {
      // Visual list of all commands, not plain text.
      return res.redirect(307, "/commands");
    },
    description: "Lists all available commands and their descriptions.",
  },
  {
    // Google Finance. This runs before the regexCommands entries for
    // gf/gfin, because a Google Finance quote URL needs an exchange
    // ("META:NASDAQ", "XEQT:TSE") and a bare ticker or a Yahoo-style
    // suffix ("XEQT.TO") does not resolve: "/quote/META" and
    // "/quote/XEQT.TO" both show a generic page. So:
    // - "gf" alone -> Google Finance home.
    // - "gf META:NASDAQ" / "gf XEQT.TO" -> converted directly.
    // - "gf meta" / "gf xeqt" / "gf apple" -> resolved via Yahoo
    //   Finance symbol search (no key), which gives the exchange.
    // If that lookup fails, fall back to the bare uppercased symbol.
    matcher: /^(gf|gfin)(?:\s+(.*))?$/,
    action: async (req, res, matches) => {
      const query = (matches[2] ?? "").trim();
      if (!query) {
        return res.redirect(307, "https://www.google.com/finance/");
      }
      const direct = toGoogleFinanceSymbol(query);
      if (direct) {
        return res.redirect(
          307,
          `https://www.google.com/finance/quote/${direct}`
        );
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        const r = await fetch(
          "https://query2.finance.yahoo.com/v1/finance/search?q=" +
            encodeURIComponent(query) +
            "&quotesCount=5&newsCount=0",
          {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (Bunny)" },
          }
        );
        if (r.ok) {
          const data = (await r.json()) as {
            quotes?: {
              symbol?: string;
              exchange?: string;
              quoteType?: string;
            }[];
          };
          for (const quote of data.quotes ?? []) {
            if (
              quote.quoteType !== "EQUITY" &&
              quote.quoteType !== "ETF"
            ) {
              continue;
            }
            const converted = quote.symbol
              ? toGoogleFinanceSymbol(quote.symbol, quote.exchange)
              : null;
            if (converted) {
              return res.redirect(
                307,
                `https://www.google.com/finance/quote/${converted}`
              );
            }
          }
        }
      } catch {
        // Fall through to the best-effort redirect below.
      } finally {
        clearTimeout(timeout);
      }
      return res.redirect(
        307,
        `https://www.google.com/finance/quote/${encodeURIComponent(
          query.toUpperCase()
        )}`
      );
    },
    description: "Redirects to Google Finance quote for the provided symbol.",
  },
  // Add more function commands as needed
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { q: query } = req.query;
    let currCmd = '';

    if (Array.isArray(query)) {
      currCmd = query.join(' ');
    } else if (typeof query === 'string') {
      currCmd = query;
    }


    // Calculator: only the explicit "calc" form opens the
    // calculator page. A bare arithmetic expression (e.g. "100*.02")
    // is NOT hijacked — it falls through to Google search, so
    // typing a calculation and pressing Enter searches Google.
    // "calc <expression>" (or a picked "calc <expr> = <result>"
    // suggestion) opens /calc and asks it to copy the answer to
    // the clipboard; a bare "calc" opens the calculator page.
    const trimmedCmd = currCmd.trim();
    if (/^calc$/i.test(trimmedCmd)) {
      return res.redirect(307, "/calc");
    }
    const calcMatch = trimmedCmd.match(/^calc\s+(.+)$/i);
    const calcRest = calcMatch?.[1];
    if (calcRest) {
      const calc = evaluateCalc(calcRest);
      if (calc) {
        return res.redirect(
          307,
          `/calc?expr=${encodeURIComponent(calc.expression)}&copy=1`
        );
      }
      // Not a calculation (e.g. "calc taxes"): fall through to
      // Google search for it.
    }

    for (const cmd of functionCommands) {
      const matches = currCmd.match(cmd.matcher);
      if (matches) {
        return cmd.action(req, res, matches);
      }
    }

    for (const cmd of regexCommands) {
      const matches = currCmd.match(cmd.matcher);
      if (matches) {
        const targetUrl = cmd.target(matches);
        return res.redirect(307, targetUrl);
      }
    }

    // catch all in case DEFAULT with proper config didn't exist
    return res.redirect(307, `https://google.com/search?q=${encodeURIComponent(currCmd)}`);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
