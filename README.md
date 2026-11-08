# Bunny

This is my take on [Bunnylol](https://github.com/rithik/bunnylol), but potentially with features that are more tailored to what I like.

## Overview

Bunny is a quick command redirection tool inspired by Bunnylol. It allows you to use shorthand commands to quickly navigate to your favorite websites, perform searches, or even open specific web applications.

## How to Use

To use Bunny, simply type a command into the input field on the Bunny homepage and press Enter. Bunny will interpret your command and redirect you accordingly.

## Available Commands

Below is a list of currently supported commands and their functions:

- `g`, `goog`, `google [query]`: Redirects to Google search with the provided query.
- `fb [query]`: Redirects to Facebook search with the provided query.
- `tel`: Opens Telegram Web.
- `nima`: Opens Nima's personal website.
- `gm`: Opens Gmail.
- `gd`: Opens Google Drive.
- `yt [query]`: Redirects to YouTube search with the provided query.
- `yt`: Opens YouTube main page.
- `r [query]`: Redirects to Reddit search with the provided query.
- `r`: Opens Reddit main page.
- `tw [query]`: Redirects to Twitter search with the provided query.
- `tw`: Opens Twitter main page.
- `n`: Opens Netflix.
- `pv`: Opens Amazon Prime Video.
- `vs`: Opens Visual Studio Code using the `vscode://` protocol.
- `cal`: Opens Google Calendar.
- `github`, `gh [query]`: Redirects to GitHub search with the provided query.
- `github`, `gh`: Opens GitHub main page.
- `ws`: Opens Wealthsimple main page.
- `gf`, `gfin [symbol]`: Redirects to the Google Finance quote for the symbol (e.g. `gf META`, `gf T.TO`).
- `gf`, `gfin`: Opens Google Finance main page.
- `muse`, `mimi [prompt]`: Opens Muse (muse.ai) with the prompt, e.g. `muse what is XEQT?`. Muse's site preserves the `?q=` parameter, so the prompt should pre-fill when you are signed in.
- `muse`, `mimi`: Opens Muse.
- `yf [symbol]`: Redirects to Yahoo Finance for the provided symbol.
- `ls`: Shows a visual list of all commands at `/commands`.
- `$`: Opens Google Finance page for Meta's stock price (as an example, adjust as needed).
- DEFAULT: Uses Google search as the default search engine for any unhandled input.

Feel free to contribute by adding more commands or suggesting features that would make Bunny more useful for you!

## Setup

To make Bunny even more accessible, you can set it as your default search engine in Chrome:

1. Open Chrome and click the three dots in the upper-right corner to access the menu. Select `Settings` and scroll down to the `Search Engine` section.

2. Click `Manage Search Engines`.

3. Under the "Other Search Engines" section, add a new search engine with the following details:
    - **Search Engine:** Bunny (or any name you prefer)
    - **Keyword:** bunny (or a shortcut of your choice)
    - **URL with %s in place of query:** `https://bunny.nima-dev.com/api/search?q=%s` (replace `bunny.nima-dev.com` with your actual domain where Bunny is hosted)

4. Find the newly added Bunny search engine in the list and click the three dots next to it, then select `Make Default`.

This will allow you to use Bunny commands directly from your address bar by typing your chosen keyword followed by a space and then your command.

## Autocomplete

Bunny now offers search suggestions as you type, in the address bar and on the homepage.

- `GET /api/suggest?q=...` returns OpenSearch suggestions JSON: `[query, [suggestion, ...]]`. It is command-aware: suggestions come from the platform the command searches, not always Google. Plain queries and `g` use Google Suggest; `yt` uses YouTube suggestions; `gh` uses GitHub repo search; `yf` uses Yahoo Finance symbol search; `gf` uses Google Finance symbols (`META:NASDAQ`, `XEQT:TSE`), converted from Yahoo's symbol search — Google Finance has no public suggest API (client=finance returns 400, ds=fin returns nothing), and its quote pages need `<TICKER>:<EXCHANGE>`: a bare `META` or a Yahoo-style `XEQT.TO` shows a generic page, so the exchange is resolved and the symbol converted (see `src/lib/googleFinance.ts`). Typing just `g` offers the matching commands.
- `public/opensearch.xml` advertises Bunny to the browser, with the search URL and the suggestions URL. The homepage links to it with `<link rel="search">`.
- `ls` now opens a visual list of all commands at `/commands`, grouped by Search / Finance / Open, with a filter box — instead of returning plain text.

Some commands have no public, unauthenticated suggest API, so they fall back to Google for now: `tw` (X's typeahead returns 403 without auth), `r` (Reddit blocks datacenter IPs), and `fb` (no suggest endpoint). No keys are used anywhere — Bunny is public, so a provider that needs a key is not an option.

Chrome's manual "add search engine" screen has no field for a suggestion URL, so after deploying this, re-add Bunny for the omnibox suggestions to take effect: in `chrome://settings/searchEngines` remove the old Bunny entry, visit https://bunny.nima-dev.com (Chrome should pick it up from the OpenSearch file), then set it as default again. The homepage search box works regardless, with no browser setup.

Note: suggestions send each keystroke to the suggestion provider for the command you typed (Google for plain/`g` searches, YouTube for `yt`, GitHub for `gh`, Yahoo Finance for `yf` and `gf`).

## Contributing

We welcome contributions to Bunny! If you have an idea for a new command or feature, or if you've found a bug, please open an issue or submit a pull request.

## License

Bunny is open-source software licensed under the MIT license.
