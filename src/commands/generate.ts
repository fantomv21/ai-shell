import ora from "ora";
import { spawn } from "child_process";
import { askOllama } from "../llm/ollama.js";
import { isSafe } from "../safety/validator.js";
import { getShell } from "../utils/os.js";

export async function generateCommand(
  userPrompt: string,
  options: { execute?: boolean; model: string }
) {
  const shell = getShell();
  const execShell = process.platform === "win32" ? "powershell.exe" : "/bin/bash";

  const systemPrompt = `You are a ${shell} command generator. Current directory: ${process.cwd()}

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

User request: ${userPrompt}
Command:`;

  const spinner = ora("Generating command...").start();

  try {
    let cmd = await askOllama(systemPrompt, options.model);

    spinner.stop();

    // Clean output - take only first non-empty line, remove markdown/quotes
    cmd = cmd
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)[0] || "";
    
    // Remove markdown code blocks and backticks
    cmd = cmd.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").replace(/^`+|`+$/g, "").trim();

    if (!cmd) {
      console.error("❌ Could not generate a command");
      return;
    }

    // Block overly complex/suspicious commands
    if (cmd.length > 200 || 
        cmd.includes('Invoke-WebRequest') || 
        cmd.includes('DownloadFile') || 
        cmd.includes('DownloadString') ||
        cmd.match(/powershell\s+-Command/i)) {
      console.error("❌ Command too complex or suspicious - try being more specific");
      return;
    }

    if (!isSafe(cmd)) {
      console.error("❌ Unsafe command blocked");
      return;
    }

    console.log("\n✅ Generated command:\n");
    console.log(`→ ${cmd}\n`);

    if (options.execute) {
      // Auto-execute without confirmation
      const child = spawn(cmd, {
        shell: execShell,
        stdio: 'inherit',
        cwd: process.cwd()
      });

      await new Promise<void>((resolve, reject) => {
        child.on('error', (err) => {
          console.error(`❌ Execution error: ${err.message}`);
          reject(err);
        });

        child.on('exit', (code) => {
          resolve();
        });
      });
    }
  } catch (err) {
    spinner.stop();
    console.error("❌ Error talking to Ollama");
  }
}
