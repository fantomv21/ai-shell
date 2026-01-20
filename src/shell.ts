#!/usr/bin/env node
import readline from "readline";
import { spawn } from "child_process";
import path from "path";
import process from "process";
import { askOllama } from "./llm/ollama.js";
import { isSafe } from "./safety/validator.js";
import { isGitRepo, getCurrentBranch, getGitStatus } from "./utils/git.js";

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
  console.log("\n" + "=".repeat(60));
  console.log("🧠  NL Shell - Natural Language Shell Interface");
  console.log("=".repeat(60));
  console.log(`\n📦  Model: ${model}`);
  console.log(`💻  Platform: ${process.platform}`);
  console.log(`📁  Working Directory: ${process.cwd()}`);
  
  // Show git info if in a repo
  const inGitRepo = await isGitRepo();
  if (inGitRepo) {
    const branch = await getCurrentBranch();
    console.log(`🌱  Git Branch: ${branch}`);
  }
 
  console.log(`\n💡  Type 'help' for commands | 'exit' or 'quit' to leave`);
  console.log("=".repeat(60) + "\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${SHELL_NAME} ❯ `
  });

  // Handle manual SIGINT (Ctrl+C) to prevent exit
  rl.on('SIGINT', () => {
    console.log(`\n(Type 'quit' or 'exit' to leave)`);
    rl.prompt();
  });

  // Main input loop
  rl.on('line', async (line) => {
    const text = line.trim();

    if (!text) {
      rl.prompt();
      return;
    }

    // --- Built-in Commands ---
    if (text === 'exit' || text === 'quit') {
      console.log('👋 Goodbye');
      process.exit(0);
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
  path, pwd, cwd          → Show current directory
  gst, gitstatus          → Show git status
  help                    → Show this message
  exit, quit              → Exit shell

EXAMPLES:
  nlsh ❯ install numpy
  nlsh ❯ python print(2+2)
  nlsh ❯ run script.py
  nlsh ❯ commit all changes with message 'initial commit'
  nlsh ❯ show files
`);
      rl.prompt();
      return;
    }

    if (text === 'pwd' || text === 'path' || text === 'where' || text === 'cwd') {
      console.log(`📁 ${process.cwd()}`);
      rl.prompt();
      return;
    }

    if (text === 'gst' || text === 'gitstatus') {
      const inGitRepo = await isGitRepo();
      if (!inGitRepo) {
        console.log('❌ Not a git repository');
      } else {
        const branch = await getCurrentBranch();
        const status = await getGitStatus();
        console.log(`🌱 Branch: ${branch}`);
        console.log(`\nStatus:\n${status}`);
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
        console.log(`📁 ${newDir}`);
      } catch (err: any) {
        console.error(`❌ cd failed: ${err.message}`);
      }
      rl.prompt();
      return;
    }

    // --- AI Command Generation ---
    process.stdout.write("⏳ Thinking... ");

    try {
      const prompt = `You are a ${getShellType()} command generator. Current directory: ${process.cwd()}

RULES:
1. Output ONLY ONE simple command. NO explanations, NO markdown, NO code blocks.
2. Keep it SIMPLE. Do NOT generate complex scripts or chained commands.
3. Package installation:
   - Python packages: pip install PACKAGE_NAME
   - Node packages: npm install PACKAGE_NAME
   - NEVER use Install-Module, Invoke-WebRequest, or download scripts
4. Navigation: ONLY when user says "go to X", "cd to X", "navigate to X" -> cd X
5. File operations:
   - "open file X" -> notepad X
   - "create file X" -> New-Item X -ItemType File -Force
   - "create folder X" -> New-Item X -ItemType Directory -Force
6. Python commands:
   - "python print hello" -> python -c "print('hello')"
   - "run python script.py" -> python script.py
   - "execute python code X" -> python -c "X"
   - "run test.py" -> python test.py
7. Git commands:
   - "git status" -> git status
   - "commit all changes with message X" -> git add . && git commit -m "X"
   - "create branch X" -> git checkout -b X
   - "switch to branch X" -> git checkout X
   - "push changes" -> git push
   - "pull latest" -> git pull
   - "show commits" or "commit history" -> git log --oneline -10
8. Greetings: "hi"/"hello" -> Write-Host "Hello!"

EXAMPLES:
- User: "install pandas" -> pip install pandas
- User: "python print hello" -> python -c "print('hello')"
- User: "run test.py" -> python test.py
- User: "commit all with message 'fix'" -> git add . && git commit -m "fix"
- User: "create branch dev" -> git checkout -b dev
- User: "create file test.txt" -> New-Item test.txt -ItemType File -Force
- User: "go to src" -> cd src
- User: "install numpy" -> pip install numpy
- User: "create file test.txt" -> New-Item test.txt -ItemType File -Force
- User: "go to src" -> cd src

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
        console.log("❌ Could not generate a command");
        rl.prompt();
        return;
      }

      // Block overly complex/suspicious commands
      if (command.length > 200 || 
          command.includes('Invoke-WebRequest') || 
          command.includes('DownloadFile') || 
          command.includes('DownloadString') ||
          command.match(/powershell\s+-Command/i)) {
        console.log("❌ Command too complex or suspicious - try being more specific");
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

      if (!isSafe(command)) {
        console.log("❌ Unsafe command blocked");
        rl.prompt();
        return;
      }

      console.log(`→ ${command}`);

      // --- Special Case: Navigation (cd) ---
      // We must handle 'cd' in the PARENT process, otherwise it only changes the child's CWD.
      if (command.startsWith("cd ") || command.startsWith("Set-Location ")) {
        const args = command.replace(/^(cd|Set-Location)\s+/, "").trim();
        const target = args.replace(/['"]/g, ""); // Remove quotes

        try {
          // Resolve path (can be relative or absolute)
          const newDir = path.resolve(process.cwd(), target);
          process.chdir(newDir);
          console.log(`📂 Changed directory to: ${newDir}`);
        } catch (err: any) {
          console.error(`❌ cd failed: ${err.message}`);
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
        console.error(`❌ Execution error: ${err.message}`);
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
      console.error("❌ Error communicating with Ollama");
      rl.prompt();
    }
  });

  rl.prompt();

  // Keep process alive
  process.stdin.resume();
}
