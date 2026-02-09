#!/usr/bin/env node
import readline from "readline";
import { spawn } from "child_process";
import path from "path";
import process from "process";
import chalk from "chalk";
import { askOllama } from "./llm/ollama.js";
import { isSafe } from "./safety/validator.js";
import { isGitRepo, getCurrentBranch, getGitStatus } from "./utils/git.js";
import { listenAndRecognize } from "./voice/speech-to-text.js";

/**
 * Shell configuration
 */
const SHELL_NAME = "nlsh";
const DEFAULT_MODEL = "mistral";

/**
 * Execution shell
 */
const EXEC_SHELL =
  process.platform === "win32"
    ? "powershell.exe"
    : "/bin/bash";

/**
 * Shell type for prompt engineering
 */
function getShellType(): string {
  return process.platform === "win32" ? "PowerShell" : "bash";
}

/**
 * Autocomplete suggestions list
 */
const AUTOCOMPLETE_SUGGESTIONS = [
  // Built-in commands
  'help', 'exit', 'quit', 'path', 'pwd', 'cwd', 'gst', 'gitstatus',
  // Common actions
  'install ', 'create file ', 'create folder ', 'open file ',
  'go to ', 'cd ', 'list ', 'show files', 'show ',
  // Python
  'python ', 'run ', 'execute python code ',
  // Git
  'git status', 'git log', 'git branch',
  'commit all changes with message ',
  'create branch ', 'switch to branch ',
  'push changes', 'pull latest', 'show commit history',
  // Common packages
  'install pandas', 'install numpy', 'install express',
  'install react', 'install flask', 'install django'
];

/**
 * Autocomplete function for common commands
 */
function autocomplete(line: string): [string[], string] {
  const hits = AUTOCOMPLETE_SUGGESTIONS.filter((c) => c.startsWith(line));
  return [hits.length ? hits : AUTOCOMPLETE_SUGGESTIONS, line];
}

/**
 * Get inline suggestion for current input
 */
function getInlineSuggestion(line: string): string {
  if (!line) return '';
  const match = AUTOCOMPLETE_SUGGESTIONS.find((s) => s.startsWith(line) && s !== line);
  return match ? match.slice(line.length) : '';
}

/**
 * AI Chat Mode - for asking questions and getting explanations
 */
async function startChatMode(rl: readline.Interface, model: string) {
  console.log(chalk.magenta.bold(`\n🤖 AI Chat Mode Started`));
  console.log(chalk.magenta(`Type ${chalk.bold('back')} or ${chalk.bold('exit')} to return to command mode\n`));

  const chatPrompt = chalk.magenta.bold(`chat ❯ `);
  rl.setPrompt(chatPrompt);
  rl.prompt();

  // Override the line handler for chat mode
  const originalListener = rl.listeners('line')[0];
  rl.removeAllListeners('line');

  rl.on('line', async (line) => {
    const text = line.trim();

    // Exit chat mode
    if (text === 'back' || text === 'exit' || text === 'quit') {
      console.log(chalk.magenta.bold(`\n👈 Returning to command mode\n`));

      // Restore original listener and prompt
      rl.removeAllListeners('line');
      rl.on('line', originalListener as any);
      rl.setPrompt(chalk.bold.cyan(`${SHELL_NAME} ❯ `));
      rl.prompt();
      return;
    }

    if (!text) {
      rl.prompt();
      return;
    }

    // Send to AI for chat response
    process.stdout.write(chalk.yellow("⏳ Thinking... "));

    try {
      const chatPromptMsg = `You are a helpful assistant. Answer the user's question concisely and clearly in 2-3 sentences.

User question: ${text}

Provide a helpful, friendly response.`;

      const response = await askOllama(chatPromptMsg, model);

      // Clear "Thinking..."
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      console.log(chalk.cyan(`\n${response}\n`));
    } catch (err) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.error(chalk.red.bold("\n❌ Error communicating with Ollama\n"));
    }

    rl.prompt();
  });
}

/**
 * Home directory (cross-platform)
 */
const HOME_DIR =
  process.platform === "win32"
    ? process.env.USERPROFILE
    : process.env.HOME;

/**
 * Start the interactive shell REPL
 */
export async function startShell(model: string = DEFAULT_MODEL) {
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
  }
  console.log("\n" + chalk.cyan("=".repeat(60)));
  console.log(chalk.bold.cyan("🧠  NL Shell - Natural Language Shell Interface"));
  console.log(chalk.cyan("=".repeat(60)));
  console.log(chalk.green(`\n📦  Model: ${chalk.yellow(model)}`));
  console.log(chalk.green(`💻  Platform: ${chalk.yellow(process.platform)}`));
  console.log(chalk.green(`📁  Working Directory: ${chalk.yellow(process.cwd())}`));

  // Show git info if in a repo
  const inGitRepo = await isGitRepo();
  if (inGitRepo) {
    const branch = await getCurrentBranch();
    console.log(chalk.green(`🌱  Git Branch: ${chalk.magenta(branch)}`));
  }

  console.log(chalk.blue(`\n💡  Type ${chalk.bold('help')} for commands | ${chalk.bold('exit')} or ${chalk.bold('quit')} to leave`));
  console.log(chalk.cyan("=".repeat(60)) + "\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold.cyan(`${SHELL_NAME} ❯ `),
    completer: autocomplete,
    terminal: true
  });

  // Variable to track current line for suggestions
  let lastLine = '';

  // Override _onLine to show suggestions
  const originalWrite = (rl as any)._writeToOutput;
  (rl as any)._writeToOutput = function (stringToWrite: string) {
    originalWrite.call(rl, stringToWrite);

    // Get current line without prompt
    const currentLine = (rl as any).line || '';

    if (currentLine && currentLine !== lastLine) {
      lastLine = currentLine;
      const suggestion = getInlineSuggestion(currentLine);

      if (suggestion) {
        // Show suggestion in gray
        const fullSuggestion = currentLine + suggestion;
        process.stdout.write(chalk.gray(suggestion));
        // Move cursor back to actual position
        for (let i = 0; i < suggestion.length; i++) {
          process.stdout.write('\x1b[D');
        }
      }
    }
  };

  // Handle manual SIGINT (Ctrl+C) to prevent exit
  rl.on('SIGINT', () => {
    console.log(`\n(Type 'quit' or 'exit' to leave)`);
    lastLine = '';
    rl.prompt();
  });

  // --- Keyboard Shortcuts (The "Buttons") ---
  if (process.stdin.isTTY) {
    process.stdin.on('keypress', async (str, key) => {
      // Ctrl+O to Trigger Voice (Open Mic)
      if (key && key.ctrl && key.name === 'o') {
        try {
          // Clear current line to avoid mess
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);

          rl.pause(); // Pause standard input

          const spokenCommand = await listenAndRecognize();

          rl.resume(); // Resume standard input

          if (spokenCommand) {
            console.log(chalk.green(`🎤 Heard: "${chalk.bold(spokenCommand)}"`));
            rl.emit('line', spokenCommand);
          } else {
            rl.prompt();
          }
        } catch (err: any) {
          rl.resume();
          // Error already logged by listenAndRecognize usually, but just in case:
          if (!err.message.includes('No speech detected')) {
            console.error(chalk.red(`\n❌ Voice Error: ${err.message}`));
          }
          rl.prompt();
        }
      }
    });
  }

  // Main input loop
  rl.on('line', async (line) => {
    const text = line.trim();
    lastLine = '';

    if (!text) {
      rl.prompt();
      return;
    }

    // --- Built-in Commands ---
    if (text === 'exit' || text === 'quit') {
      console.log(chalk.yellow('👋 Goodbye'));
      process.exit(0);
    }

    if (text === 'chat' || text === 'enter chat') {
      await startChatMode(rl, model);
      return;
    }

    // --- Voice Command ---
    if (text === 'voice' || text === 'listen') {
      try {
        // Pause readline to prevent interference
        rl.pause();

        const spokenCommand = await listenAndRecognize();

        rl.resume(); // Resume readline

        if (spokenCommand) {
          console.log(chalk.green(`🎤 Heard: "${chalk.bold(spokenCommand)}"`));

          // Emit the line event to process the command as if typed
          rl.emit('line', spokenCommand);
        } else {
          rl.prompt();
        }
      } catch (err: any) {
        rl.resume();
        console.error(chalk.red(`\n❌ Voice Error: ${err.message}`));
        rl.prompt();
      }
      return;
    }

    if (text === 'help') {
      console.log(`
🧠 NL Shell - Natural Language Shell Commands

WHAT I CAN DO:
  📦 Install packages      → "install pandas", "install express"
  📁 Navigate folders      → "go to src", "move to Documents"
  📄 Create files/folders  → "create file test.txt", "create folder data"
  ✏️  Open files           → "open file config.json"
  📋 List directory        → "show files", "list contents"
  🔍 Search files          → "find all .txt files"
  💬 Chat                  → "hi", "hello"
  🎤 Voice Input           → "voice", "listen" OR Press Ctrl+O
  
🤖 AI CHAT MODE:
  • "chat" or "enter chat" - Toggle to chat mode
  • Ask questions: "how do I deploy to AWS?"
  • Get explanations: "explain what REST API is"
  • Tips & tricks: "give me npm shortcuts"
  • In chat mode, type "back" or "exit" to return
  
🐍 PYTHON COMMANDS:
  • "run python script.py"
  • "python print hello world"
  • "execute python code print(2+2)"
  • "run test.py"
  
🌱 GIT INTEGRATION:
  • "git status" or "show git status"
  • "commit all changes with message 'fix bug'"
  • "create branch feature-x"
  • "switch to main branch"
  • "push changes"
  • "pull latest"
  • "show commit history"
  
BUILT-IN COMMANDS:

  help                    → Show this message
  exit, quit              → Exit shell

EXAMPLES:
  nlsh ❯ install numpy
  nlsh ❯ python print(2+2)
  nlsh ❯ chat
  nlsh ❯ commit all changes with message 'initial commit'
  nlsh ❯ show files
`);
      rl.prompt();
      return;
    }

    if (text === 'pwd' || text === 'path' || text === 'where' || text === 'cwd') {
      console.log(chalk.blue(`📁 ${chalk.cyan(process.cwd())}`));
      rl.prompt();
      return;
    }

    if (text === 'gst' || text === 'gitstatus') {
      const inGitRepo = await isGitRepo();
      if (!inGitRepo) {
        console.log(chalk.red('❌ Not a git repository'));
      } else {
        const branch = await getCurrentBranch();
        const status = await getGitStatus();
        console.log(chalk.green(`🌱 Branch: ${chalk.magenta(branch)}`));
        console.log(chalk.gray(`\nStatus:\n${status}`));
      }
      rl.prompt();
      return;
    }

    if (text.startsWith('cd ') || text === 'cd') {
      const args = text.slice(3).trim();
      const target = args || HOME_DIR || process.cwd();
      try {
        const newDir = path.resolve(process.cwd(), target);
        process.chdir(newDir);
        console.log(chalk.blue(`📁 ${chalk.cyan(newDir)}`))
      } catch (err: any) {
        console.error(chalk.red(`❌ cd failed: ${err.message}`));
      }
      rl.prompt();
      return;
    }

    // --- AI Command Generation ---
    process.stdout.write(chalk.yellow("⏳ Thinking... "));

    try {
      const shellType = getShellType();
      const prompt = `You are a ${shellType} command generator for Windows. Current directory: ${process.cwd()}

CRITICAL RULES:
1. Output ONLY the executable command. NO explanations, NO markdown, NO code blocks.
2. Keep it SIMPLE. Avoid complex multi-step operations.
3. NEVER use placeholder text like "REPO_URL", "YOUR_URL", "PATH" - ask for specifics or skip that part.
4. ${shellType === 'PowerShell' ? 'IMPORTANT: Use SEMICOLON (;) to chain commands, NOT && which fails in PowerShell!' : 'Use && to chain commands.'}

COMMAND PATTERNS:
- Package installation:
   • Python: pip install PACKAGE_NAME
   • Node: npm install PACKAGE_NAME
   • NEVER use Install-Module, Invoke-WebRequest, or download scripts
   
- Navigation: cd DIRECTORY_NAME

- File operations:
   • "open file X" -> notepad X  
   • "create file X" -> New-Item X -ItemType File -Force
   • "create folder X" -> New-Item X -ItemType Directory -Force

- Python:
   • "python print X" -> python -c "print('X')"
   • "run script.py" -> python script.py

- Git commands (USE ; NOT &&):
   • "git status" -> git status
   • "commit all with message X" -> git add .; git commit -m "X"
   • "create branch X" -> git checkout -b X
   • "switch to X" -> git checkout X
   • "push" -> git push
   • "pull" -> git pull
   • "create new repo" -> git init
   • "create repo and push" -> git init; git add .; git commit -m "Initial commit"
   
- Greetings: Write-Host "Hello!"

EXAMPLES:
- "install pandas" -> pip install pandas
- "commit all with message 'fix'" -> git add .; git commit -m "fix"
- "create new repo" -> git init
- "go to src" -> cd src

User request: ${text}
Command:`;

      let command = await askOllama(prompt, model);

      // Clear "Thinking..."
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      // Clean output - take only first non-empty line, remove markdown/quotes
      command = command
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean)[0] || "";

      // Remove markdown code blocks and backticks
      command = command.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").replace(/^`+|`+$/g, "").trim();

      if (!command) {
        console.log(chalk.red("❌ Could not generate a command"));
        rl.prompt();
        return;
      }

      // Block overly complex/suspicious commands
      if (command.length > 200 ||
        command.includes('Invoke-WebRequest') ||
        command.includes('DownloadFile') ||
        command.includes('DownloadString') ||
        command.match(/powershell\s+-Command/i)) {
        console.log(chalk.red("❌ Command too complex or suspicious - try being more specific"));
        rl.prompt();
        return;
      }

      // --- Heuristics: Fix Python/Node mismatches ---
      if (command.match(/^Install-Module\s+/i)) {
        // If we see typical python deps, force pip
        if (command.match(/\b(pandas|numpy|matplotlib|scikit-learn|django|flask|torch|tensorflow|scipy|requests|beautifulsoup4|sqlalchemy|pytest|jupyter)\b/i)) {
          command = command.replace(/Install-Module\s+(\S+).*/i, "pip install $1");
        }
      }

      // --- PowerShell-specific fixes ---
      if (process.platform === 'win32') {
        // Convert bash-style && to PowerShell-compatible ;
        command = command.replace(/\s*&&\s*/g, '; ');

        // Block commands with placeholder URLs (AI sometimes generates these)
        if (command.match(/\b(REPO_URL|YOUR_URL|URL_HERE|REMOTE_URL|ORIGIN_URL)\b/i)) {
          console.log(chalk.yellow("⚠️  That requires a specific URL. Try: git remote add origin https://github.com/user/repo.git"));
          rl.prompt();
          return;
        }
      }

      if (!isSafe(command)) {
        console.log(chalk.red.bold("❌ Unsafe command blocked"));
        rl.prompt();
        return;
      }

      console.log(chalk.green(`→ ${chalk.bold.white(command)}`));

      // --- Special Case: Navigation (cd) ---
      // We must handle 'cd' in the PARENT process, otherwise it only changes the child's CWD.
      if (command.startsWith("cd ") || command.startsWith("Set-Location ")) {
        const args = command.replace(/^(cd|Set-Location)\s+/, "").trim();
        const target = args.replace(/['"]/g, ""); // Remove quotes

        try {
          // Resolve path (can be relative or absolute)
          const newDir = path.resolve(process.cwd(), target);
          process.chdir(newDir);
          console.log(chalk.blue(`📂 Changed directory to: ${chalk.cyan(newDir)}`));
        } catch (err: any) {
          console.error(chalk.red(`❌ cd failed: ${err.message}`));
        }
        rl.prompt();
        return;
      }

      // --- Execute with Spawn (Inherit STDIO) ---
      // This allows interactive commands (vim, python, etc) and proper output streaming
      rl.pause(); // Pause readline so it doesn't interfere

      const child = spawn(command, {
        shell: EXEC_SHELL,
        stdio: 'inherit', // Child takes over terminal
        cwd: process.cwd()
      });

      child.on('error', (err) => {
        console.error(chalk.red(`❌ Execution error: ${err.message}`));
        rl.resume();
        rl.prompt();
      });

      child.on('exit', (code) => {
        // Child finished, resume our shell
        rl.resume();
        rl.prompt();
      });

    } catch (err) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.error(chalk.red.bold("❌ Error communicating with Ollama"));
      rl.prompt();
    }
  });

  rl.prompt();

  // Keep process alive
  process.stdin.resume();
}
