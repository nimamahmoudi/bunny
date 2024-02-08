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
    - **URL with %s in place of query:** `https://bunny.nima-dev.com/search?q=%s` (replace `bunny.nima-dev.com` with your actual domain where Bunny is hosted)

4. Find the newly added Bunny search engine in the list and click the three dots next to it, then select `Make Default`.

This will allow you to use Bunny commands directly from your address bar by typing your chosen keyword followed by a space and then your command.


## Contributing

We welcome contributions to Bunny! If you have an idea for a new command or feature, or if you've found a bug, please open an issue or submit a pull request.

## License

Bunny is open-source software licensed under the MIT license.
