import { NextApiRequest, NextApiResponse } from 'next';
import regexCommandsData from '@/lib/regexCommands.json'; // Adjust the path as necessary

type FunctionCommand = {
  matcher: RegExp;
  action: (req: NextApiRequest, res: NextApiResponse, matches: RegExpMatchArray) => void;
  description: string;
};

type RegexCommandRaw = {
  pattern: string;
  targetTemplate: string;
  description: string;
  encodeForSearch: boolean;
  encodeURI: boolean;
};

type RegexCommand = {
  name: string;
  matcher: RegExp;
  target: (matches: RegExpMatchArray) => string;
  description: string;
};

interface CommandItem {
  matcher: RegExp;
}

const encodeForSearch = (query: string) => {
  return query.replace(/\s/g, '+')
}

const getCommandFromMatcher = (item: CommandItem) => {
  const commandNameMatch = item.matcher.toString().match(/\(([^)]+)\)/);
  const commandName = commandNameMatch ? commandNameMatch[1] : 'Unknown Command';
  return commandName
}

// Convert JSON data into usable commands
const regexCommands: RegexCommand[] = Object.entries(regexCommandsData).map(([name, cmd]: [string, RegexCommandRaw]) => ({
  ...cmd,
  name,
  matcher: new RegExp(cmd.pattern),
  target: (matches: RegExpMatchArray) => {
    // Ensure matches[2] is defined before using it
    let searchTerm = matches[2] !== undefined ? matches[2] : '';
    if (cmd.encodeURI) {
      searchTerm = encodeForSearch(searchTerm);
    }
    if (cmd.encodeURI) {
      searchTerm = encodeURIComponent(searchTerm);
    }
    return cmd.targetTemplate.replace('$1', searchTerm);
  },
})).sort( // sort in a way that DEFAULT is always last
  (a: RegexCommand, b: RegexCommand) => {
    if (a.name === "DEFAULT") return 1;
    if (b.name === "DEFAULT") return -1;
    return 0
  }
);

const functionCommands: FunctionCommand[] = [
  {
    matcher: /^(ls|list)$/,
    action: (req, res, matches) => {
      const commandsList = [
        ...regexCommands.map(cmd => `${getCommandFromMatcher(cmd)}: ${cmd.description}`),
        ...functionCommands.map(cmd => `${getCommandFromMatcher(cmd)}: ${cmd.description}`),
      ].join('\n');
      res.send(`Available commands:\n${commandsList}`);
    },
    description: "Lists all available commands and their descriptions.",
  },
  // Add more function commands as needed
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { q: query } = req.query;
    let currCmd: string = '';

    if (Array.isArray(query)) {
      currCmd = query.join(' ');
    } else if (typeof query === 'string') {
      currCmd = query;
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
        // return res.send(targetUrl);
      }
    }

    // catch all in case DEFAULT with proper config didn't exist
    return res.redirect(307, `https://google.com/search?q=${encodeURIComponent(encodeForSearch(currCmd))}`);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
