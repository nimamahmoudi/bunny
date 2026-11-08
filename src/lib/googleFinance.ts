// Google Finance quote symbols are "<TICKER>:<EXCHANGE>", e.g.
// "META:NASDAQ" and "XEQT:TSE". Two things that do NOT work, verified
// live:
// - a bare ticker: "/quote/META" and "/quote/XEQT" return a generic
//   "Google Finance" page, not the quote.
// - a Yahoo suffix: "/quote/XEQT.TO" and "/quote/T.TO" are also
//   generic — Google does not understand ".TO".
// "/quote/META:NASDAQ", "/quote/XEQT:TSE" and "/quote/T:TSE" render
// the quote page. So a Yahoo Finance symbol (and its exchange, from
// the Yahoo symbol-search API) has to be converted to Google format
// before it is used as a suggestion or a redirect target.

const EXCHANGE_BY_YAHOO_CODE: Record<string, string> = {
  NMS: "NASDAQ",
  NGM: "NASDAQ",
  NYQ: "NYSE",
  ASE: "NYSEAMERICAN",
  TOR: "TSE",
  CVE: "CVE",
  NEO: "NEO",
  LSE: "LON",
  PAR: "EPA",
  AMS: "AMS",
  FRA: "FRA",
  GER: "FRA",
  ASX: "ASX",
  HKG: "HKG",
  KRX: "KRX",
  TYO: "TYO",
  SHG: "SHA",
  SHE: "SHE",
  NSI: "NSE",
  BSE: "BOM",
  SES: "SES",
  NZE: "NZE",
  BIT: "BIT",
  SWX: "SWX",
  EBR: "EBR",
  BME: "BME",
  STO: "STO",
  CPH: "CPH",
  HEL: "HEL",
  OSL: "OSL",
};

const EXCHANGE_BY_YAHOO_SUFFIX: Record<string, string> = {
  TO: "TSE",
  V: "CVE",
  NE: "NEO",
  L: "LON",
  PA: "EPA",
  AS: "AMS",
  DE: "FRA",
  F: "FRA",
  AX: "ASX",
  HK: "HKG",
  KS: "KRX",
  KQ: "KOSDAQ",
  T: "TYO",
  SS: "SHA",
  SZ: "SHE",
  BO: "BOM",
  NS: "NSE",
  SI: "SES",
  NZ: "NZE",
  MI: "BIT",
  SW: "SWX",
  BR: "EBR",
  MC: "BME",
  ST: "STO",
  CO: "CPH",
  HE: "HEL",
  OL: "OSL",
  VX: "SWX",
  VI: "VIE",
  LS: "ELI",
  AT: "ATH",
  IS: "IST",
  TA: "TLV",
  TW: "TPE",
  JO: "JSE",
  MX: "BMV",
  SA: "BVMF",
};

/**
 * Convert a Yahoo Finance symbol (optionally with its Yahoo exchange
 * code, e.g. "NMS", "TOR") to a Google Finance quote symbol
 * ("META:NASDAQ", "XEQT:TSE"). Returns null when the symbol cannot
 * be expressed as a Google Finance quote — futures ("SMETA=F"),
 * currencies ("CAD=X") and indices ("^GSPC") have no such form, and
 * a bare ticker with no exchange info cannot be resolved either.
 */
export function toGoogleFinanceSymbol(
  symbol: string,
  yahooExchange?: string
): string | null {
  const upper = symbol.trim().toUpperCase();
  if (!upper || upper.includes("=") || upper.startsWith("^")) return null;

  // Already Google format: "META:NASDAQ".
  if (upper.includes(":")) {
    const [ticker, exchange] = upper.split(":");
    if (ticker && exchange) return `${ticker}:${exchange}`;
    return null;
  }

  // Yahoo suffix: "XEQT.TO" -> "XEQT:TSE", "T.TO" -> "T:TSE".
  const dot = upper.lastIndexOf(".");
  if (dot > 0) {
    const base = upper.slice(0, dot);
    const suffix = upper.slice(dot + 1);
    const exchange = EXCHANGE_BY_YAHOO_SUFFIX[suffix];
    if (exchange && base) return `${base}:${exchange}`;
    return null;
  }

  // Bare ticker: the exchange has to come from the Yahoo API.
  if (yahooExchange) {
    const exchange =
      EXCHANGE_BY_YAHOO_CODE[yahooExchange.trim().toUpperCase()];
    if (exchange) return `${upper}:${exchange}`;
  }
  return null;
}
