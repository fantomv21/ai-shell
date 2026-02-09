/**
 * NLSH Web UI - Natural Language Shell Interface
 * Main Application JavaScript
 */

// ==================
// STATE MANAGEMENT
// ==================
const state = {
    mode: 'shell', // 'shell' or 'chat'
    model: 'mistral',
    currentPath: 'C:\\Users\\' + (window.navigator.userAgent.includes('Windows') ? 'User' : 'user'),
    commandHistory: [],
    historyIndex: -1,
    ollamaConnected: false,
    isProcessing: false,
    suggestions: [
        'help', 'exit', 'quit', 'path', 'pwd', 'cwd', 'gst', 'gitstatus',
        'install ', 'create file ', 'create folder ', 'open file ',
        'go to ', 'cd ', 'list ', 'show files', 'show ',
        'python ', 'run ', 'execute python code ',
        'git status', 'git log', 'git branch',
        'commit all changes with message ',
        'create branch ', 'switch to branch ',
        'push changes', 'pull latest', 'show commit history'
    ]
};

// ==================
// DOM ELEMENTS
// ==================
const elements = {
    terminalBody: document.getElementById('terminal-body'),
    terminalOutput: document.getElementById('terminal-output'),
    terminalInput: document.getElementById('terminal-input'),
    inputSuggestion: document.getElementById('input-suggestion'),
    promptLabel: document.getElementById('prompt-label'),
    sendBtn: document.getElementById('send-btn'),
    clearBtn: document.getElementById('clear-btn'),
    voiceBtn: document.getElementById('voice-btn'),
    modelSelect: document.getElementById('model-select'),
    ollamaStatus: document.getElementById('ollama-status'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    voiceModal: document.getElementById('voice-modal'),
    voiceCancel: document.getElementById('voice-cancel'),
    hintsPanel: document.getElementById('hints-panel'),
    hintsClose: document.getElementById('hints-close'),
    currentModel: document.getElementById('current-model'),
    currentPlatform: document.getElementById('current-platform'),
    currentPath: document.getElementById('current-path'),
    terminalTitle: document.getElementById('terminal-title'),
    navBtns: document.querySelectorAll('.nav-btn'),
    quickCmds: document.querySelectorAll('.quick-cmd'),
    hintChips: document.querySelectorAll('.hint-chip')
};

// ==================
// API FUNCTIONS
// ==================
const OLLAMA_BASE = 'http://localhost:11434';
const SERVER_BASE = 'http://localhost:3000';

async function checkOllamaConnection() {
    try {
        const response = await fetch(`${OLLAMA_BASE}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
            state.ollamaConnected = true;
            elements.ollamaStatus.classList.add('connected');
            return true;
        }
    } catch (error) {
        state.ollamaConnected = false;
        elements.ollamaStatus.classList.remove('connected');
    }
    return false;
}

async function askOllama(prompt, model = state.model) {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error('Failed to communicate with Ollama');
    }

    const data = await response.json();
    return data.response.trim();
}

async function executeRealCommand(command) {
    try {
        const response = await fetch(`${SERVER_BASE}/api/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ command })
        });

        const data = await response.json();

        if (data.cwd) {
            state.currentPath = data.cwd;
            elements.currentPath.textContent = state.currentPath;
        }

        return data;
    } catch (error) {
        return { success: false, error: 'Server not running. Using simulation mode.' };
    }
}

async function fetchCurrentPath() {
    try {
        const response = await fetch(`${SERVER_BASE}/api/cwd`);
        const data = await response.json();
        if (data.cwd) {
            state.currentPath = data.cwd;
            elements.currentPath.textContent = state.currentPath;
        }
    } catch (error) {
        // Server not available, use default path
    }
}

// ==================
// COMMAND PROCESSING
// ==================
async function processCommand(input) {
    const text = input.trim();
    if (!text) return;

    // Add to history
    state.commandHistory.push(text);
    state.historyIndex = state.commandHistory.length;

    // Add command to output
    addCommandLine(text);

    // Built-in commands
    if (text === 'exit' || text === 'quit') {
        addOutput('👋 Goodbye! (Close this tab to exit)', 'info');
        return;
    }

    if (text === 'help') {
        showHelp();
        return;
    }

    if (text === 'clear' || text === 'cls') {
        clearTerminal();
        return;
    }

    if (text === 'pwd' || text === 'path' || text === 'where' || text === 'cwd') {
        addOutput(`📁 ${state.currentPath}`, 'info');
        return;
    }

    if (text === 'chat' || text === 'enter chat') {
        switchToChat();
        return;
    }

    if (text === 'back' && state.mode === 'chat') {
        switchToShell();
        return;
    }

    if (text === 'gst' || text === 'gitstatus') {
        await executeGitStatus();
        return;
    }

    // CD command
    if (text.startsWith('cd ') || text === 'cd') {
        const target = text.slice(3).trim() || '~';
        handleCd(target);
        return;
    }

    // AI-powered command generation
    await generateAndExecuteCommand(text);
}

async function generateAndExecuteCommand(input) {
    if (!state.ollamaConnected) {
        addOutput('❌ Ollama is not connected. Please start Ollama and refresh.', 'error');
        return;
    }

    showLoading('⏳ Generating command...');

    try {
        const shellType = navigator.platform.includes('Win') ? 'PowerShell' : 'bash';

        let prompt;

        if (state.mode === 'chat') {
            prompt = `You are a helpful assistant. Answer the user's question concisely and clearly in 2-3 sentences.

User question: ${input}

Provide a helpful, friendly response.`;

            const response = await askOllama(prompt, state.model);
            hideLoading();
            addAIResponse(response);
        } else {
            prompt = `You are a ${shellType} command generator. Current directory: ${state.currentPath}

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
   - "commit all changes with message X" -> git add .; git commit -m "X"
   - "create branch X" -> git checkout -b X
   - "switch to branch X" -> git checkout X
   - "push changes" -> git push
   - "pull latest" -> git pull
   - "show commits" or "commit history" -> git log --oneline -10
   NOTE: Use semicolon (;) NOT && for command chaining in PowerShell
8. Greetings: "hi"/"hello" -> Write-Host "Hello!"

EXAMPLES:
- User: "install pandas" -> pip install pandas
- User: "python print hello" -> python -c "print('hello')"
- User: "run test.py" -> python test.py
- User: "commit all with message 'fix'" -> git add .; git commit -m "fix"
- User: "create branch dev" -> git checkout -b dev
- User: "create file test.txt" -> New-Item test.txt -ItemType File -Force
- User: "go to src" -> cd src
- User: "show files" -> Get-ChildItem
- User: "list files" -> ls

User request: ${input}
Command:`;

            let command = await askOllama(prompt, state.model);
            hideLoading();

            // Clean the command
            command = cleanCommand(command);

            if (!command) {
                addOutput('❌ Could not generate a command', 'error');
                return;
            }

            // Check for dangerous commands
            if (!isSafe(command)) {
                addOutput('❌ Unsafe command blocked for your protection', 'error');
                return;
            }

            // Show generated command
            addGeneratedCommand(command);

            // Execute the command (real or simulated)
            await executeCommand(command);
        }
    } catch (error) {
        hideLoading();
        addOutput(`❌ Error: ${error.message}`, 'error');
    }
}

function cleanCommand(command) {
    // Take only first non-empty line
    command = command
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)[0] || '';

    // Remove markdown code blocks and backticks
    command = command
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/\n?```$/i, '')
        .replace(/^`+|`+$/g, '')
        .trim();

    return command;
}

function isSafe(command) {
    const dangerousPatterns = [
        /rm\s+-rf\s+[\/\\]/i,
        /format\s+[a-z]:/i,
        /del\s+[\/\\]\*/i,
        /Remove-Item\s+.*-Recurse.*-Force/i,
        /Invoke-WebRequest/i,
        /DownloadFile/i,
        /DownloadString/i,
        /powershell\s+-Command/i,
        /shutdown/i,
        /:(){ :|:& };:/
    ];

    if (command.length > 200) return false;

    for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) return false;
    }

    return true;
}

// ==================
// OUTPUT FUNCTIONS
// ==================
function addCommandLine(text) {
    const entry = document.createElement('div');
    entry.className = 'command-entry';

    const promptText = state.mode === 'chat' ? 'chat ❯' : 'nlsh ❯';

    entry.innerHTML = `
    <div class="command-line">
      <span class="cmd-prompt">${promptText}</span>
      <span class="cmd-text">${escapeHtml(text)}</span>
    </div>
  `;

    elements.terminalOutput.appendChild(entry);
    scrollToBottom();
}

function addGeneratedCommand(command) {
    const div = document.createElement('div');
    div.className = 'generated-command';
    div.innerHTML = `
    <div class="generated-label">→ Generated Command</div>
    <div class="generated-text">${escapeHtml(command)}</div>
  `;
    elements.terminalOutput.appendChild(div);
    scrollToBottom();
}

function addOutput(text, type = 'normal') {
    const div = document.createElement('div');
    div.className = `command-output ${type}`;
    div.innerHTML = escapeHtml(text);
    elements.terminalOutput.appendChild(div);
    scrollToBottom();
}

function addAIResponse(text) {
    const div = document.createElement('div');
    div.className = 'ai-response';
    div.innerHTML = `
    <div class="ai-response-label">🤖 AI Response</div>
    <div class="ai-response-text">${escapeHtml(text)}</div>
  `;
    elements.terminalOutput.appendChild(div);
    scrollToBottom();
}

function showHelp() {
    const helpHtml = `
<div class="help-output">
  <div class="help-section">
    <div class="help-section-title">🧠 What I Can Do</div>
    <div class="help-item"><span class="help-cmd">install pandas</span><span class="help-desc">Install Python/Node packages</span></div>
    <div class="help-item"><span class="help-cmd">go to src</span><span class="help-desc">Navigate to directories</span></div>
    <div class="help-item"><span class="help-cmd">create file test.txt</span><span class="help-desc">Create files and folders</span></div>
    <div class="help-item"><span class="help-cmd">show files</span><span class="help-desc">List directory contents</span></div>
    <div class="help-item"><span class="help-cmd">git status</span><span class="help-desc">Git commands</span></div>
    <div class="help-item"><span class="help-cmd">python print hello</span><span class="help-desc">Run Python code</span></div>
  </div>
  
  <div class="help-section">
    <div class="help-section-title">🤖 Chat Mode</div>
    <div class="help-item"><span class="help-cmd">chat</span><span class="help-desc">Enter AI chat mode</span></div>
    <div class="help-item"><span class="help-cmd">back</span><span class="help-desc">Return to shell mode</span></div>
  </div>
  
  <div class="help-section">
    <div class="help-section-title">💻 Built-in Commands</div>
    <div class="help-item"><span class="help-cmd">help</span><span class="help-desc">Show this help</span></div>
    <div class="help-item"><span class="help-cmd">clear</span><span class="help-desc">Clear terminal</span></div>
    <div class="help-item"><span class="help-cmd">pwd</span><span class="help-desc">Show current path</span></div>
    <div class="help-item"><span class="help-cmd">exit</span><span class="help-desc">Exit shell</span></div>
  </div>
</div>
  `;

    elements.terminalOutput.innerHTML += helpHtml;
    scrollToBottom();
}

async function executeCommand(command) {
    // Try to execute via backend first
    showLoading('⚡ Executing...');

    const result = await executeRealCommand(command);
    hideLoading();

    if (result.success) {
        if (result.output) {
            addOutput(result.output, 'success');
        } else {
            addOutput('✅ Command executed successfully', 'success');
        }
    } else if (result.error && result.error.includes('Server not running')) {
        // Fall back to simulation mode
        simulateExecution(command);
    } else {
        addOutput(`❌ ${result.error}`, 'error');
    }
}

function simulateExecution(command) {
    // Simulate command execution with realistic output
    const lowerCmd = command.toLowerCase();

    if (lowerCmd.includes('get-childitem') || lowerCmd === 'ls' || lowerCmd === 'dir') {
        addOutput(`
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----          2/9/2026  10:30 AM                .git
d-----          2/9/2026  10:30 AM                node_modules
d-----          2/9/2026  10:30 AM                src
-a----          2/9/2026  10:30 AM            638 package.json
-a----          2/9/2026  10:30 AM            241 tsconfig.json
-a----          2/9/2026  10:30 AM             26 README.md
    `, 'success');
    } else if (lowerCmd.includes('pip install') || lowerCmd.includes('npm install')) {
        const pkg = command.split(' ').pop();
        addOutput(`✅ Successfully installed ${pkg}`, 'success');
    } else if (lowerCmd.includes('git status')) {
        addOutput(`On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`, 'success');
    } else if (lowerCmd.includes('write-host')) {
        const msg = command.match(/["'](.+?)["']/)?.[1] || 'Hello!';
        addOutput(msg, 'success');
    } else if (lowerCmd.includes('new-item')) {
        const name = command.match(/New-Item\s+(\S+)/i)?.[1] || 'item';
        addOutput(`✅ Created: ${name}`, 'success');
    } else if (lowerCmd.includes('git log')) {
        addOutput(`a1b2c3d feat: add new feature
e4f5g6h fix: resolve bug
i7j8k9l docs: update readme
m0n1o2p refactor: clean up code
q3r4s5t initial commit`, 'success');
    } else if (lowerCmd.includes('python')) {
        if (lowerCmd.includes('-c')) {
            const code = command.match(/-c\s+["'](.+?)["']/)?.[1] || '';
            try {
                // Simple eval for demo purposes
                if (code.includes('print')) {
                    const printMatch = code.match(/print\s*\(\s*['"]?(.+?)['"]?\s*\)/);
                    if (printMatch) {
                        addOutput(printMatch[1], 'success');
                    } else if (code.includes('+') || code.includes('-') || code.includes('*')) {
                        addOutput(eval(code.replace(/print\s*\(\s*|\s*\)/g, '')).toString(), 'success');
                    }
                }
            } catch {
                addOutput('>>> Python executed', 'success');
            }
        } else {
            addOutput('>>> Script executed successfully', 'success');
        }
    } else {
        addOutput(`Command executed: ${command}`, 'success');
    }
}

async function executeGitStatus() {
    addOutput(`On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   src/shell.ts

no changes added to commit (use "git add" and/or "git commit -a")`, 'success');
}

async function handleCd(target) {
    const cdCmd = `cd ${target}`;
    const result = await executeRealCommand(cdCmd);

    if (result.success) {
        if (result.cwd) {
            state.currentPath = result.cwd;
            elements.currentPath.textContent = state.currentPath;
        }
        addOutput(`📂 Changed directory to: ${state.currentPath}`, 'success');
    } else if (result.error && result.error.includes('Server not running')) {
        // Fallback simulation
        if (target === '~' || target === '') {
            state.currentPath = 'C:\\Users\\User';
        } else if (target === '..') {
            const parts = state.currentPath.split('\\');
            if (parts.length > 1) {
                parts.pop();
                state.currentPath = parts.join('\\') || 'C:\\';
            }
        } else if (target.includes(':')) {
            state.currentPath = target;
        } else {
            state.currentPath = state.currentPath + '\\' + target;
        }
        elements.currentPath.textContent = state.currentPath;
        addOutput(`📂 Changed directory to: ${state.currentPath}`, 'success');
    } else {
        addOutput(`❌ cd failed: ${result.error}`, 'error');
    }
}

// ==================
// MODE SWITCHING
// ==================
function switchToChat() {
    state.mode = 'chat';
    elements.promptLabel.textContent = 'chat ❯';
    elements.promptLabel.classList.add('chat-mode');
    elements.terminalInput.placeholder = 'Ask me anything...';
    elements.terminalTitle.textContent = 'nlsh — AI Chat Mode';

    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === 'chat');
    });

    addOutput('🤖 Entered AI Chat Mode. Type "back" to return to shell.', 'info');
}

function switchToShell() {
    state.mode = 'shell';
    elements.promptLabel.textContent = 'nlsh ❯';
    elements.promptLabel.classList.remove('chat-mode');
    elements.terminalInput.placeholder = 'Type a command in plain English...';
    elements.terminalTitle.textContent = 'nlsh — Natural Language Shell';

    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === 'shell');
    });

    addOutput('👈 Returned to Shell Mode.', 'info');
}

// ==================
// UI HELPERS
// ==================
function clearTerminal() {
    elements.terminalOutput.innerHTML = '';
}

function scrollToBottom() {
    elements.terminalBody.scrollTop = elements.terminalBody.scrollHeight;
}

function showLoading(text = '⏳ Processing...') {
    state.isProcessing = true;
    elements.loadingText.textContent = text;
    elements.loadingOverlay.classList.add('visible');
    elements.sendBtn.disabled = true;
}

function hideLoading() {
    state.isProcessing = false;
    elements.loadingOverlay.classList.remove('visible');
    elements.sendBtn.disabled = false;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateSuggestion() {
    const input = elements.terminalInput.value;
    if (!input) {
        elements.inputSuggestion.textContent = '';
        return;
    }

    const match = state.suggestions.find(s => s.startsWith(input) && s !== input);
    if (match) {
        // Show the suggestion in the ghost text
        elements.inputSuggestion.textContent = input + match.slice(input.length);
    } else {
        elements.inputSuggestion.textContent = '';
    }
}

function acceptSuggestion() {
    const input = elements.terminalInput.value;
    const match = state.suggestions.find(s => s.startsWith(input) && s !== input);
    if (match) {
        elements.terminalInput.value = match;
        elements.inputSuggestion.textContent = '';
    }
}

// ==================
// EVENT HANDLERS
// ==================
function initEventListeners() {
    // Send button
    elements.sendBtn.addEventListener('click', () => {
        const input = elements.terminalInput.value;
        if (input && !state.isProcessing) {
            processCommand(input);
            elements.terminalInput.value = '';
            elements.inputSuggestion.textContent = '';
        }
    });

    // Input field
    elements.terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const input = elements.terminalInput.value;
            if (input && !state.isProcessing) {
                processCommand(input);
                elements.terminalInput.value = '';
                elements.inputSuggestion.textContent = '';
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            acceptSuggestion();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (state.historyIndex > 0) {
                state.historyIndex--;
                elements.terminalInput.value = state.commandHistory[state.historyIndex] || '';
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (state.historyIndex < state.commandHistory.length - 1) {
                state.historyIndex++;
                elements.terminalInput.value = state.commandHistory[state.historyIndex] || '';
            } else {
                state.historyIndex = state.commandHistory.length;
                elements.terminalInput.value = '';
            }
        }
    });

    // Input suggestion
    elements.terminalInput.addEventListener('input', updateSuggestion);

    // Clear button
    elements.clearBtn.addEventListener('click', clearTerminal);

    // Voice button (demo)
    elements.voiceBtn.addEventListener('click', () => {
        elements.voiceModal.classList.add('visible');
        setTimeout(() => {
            elements.voiceModal.classList.remove('visible');
            elements.terminalInput.value = 'show files';
            elements.terminalInput.focus();
        }, 2000);
    });

    elements.voiceCancel.addEventListener('click', () => {
        elements.voiceModal.classList.remove('visible');
    });

    // Model select
    elements.modelSelect.addEventListener('change', (e) => {
        state.model = e.target.value;
        elements.currentModel.textContent = state.model;
    });

    // Navigation buttons
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.mode === 'chat') {
                switchToChat();
            } else {
                switchToShell();
            }
        });
    });

    // Quick commands
    elements.quickCmds.forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.dataset.cmd;
            elements.terminalInput.value = cmd;
            elements.terminalInput.focus();
        });
    });

    // Hint chips
    elements.hintChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.terminalInput.value = chip.dataset.hint;
            elements.terminalInput.focus();
        });
    });

    // Hints panel close
    elements.hintsClose.addEventListener('click', () => {
        elements.hintsPanel.classList.add('hidden');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+O for voice
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            elements.voiceBtn.click();
        }

        // Ctrl+L to clear
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            clearTerminal();
        }

        // Focus input on any key if not already focused
        if (!e.ctrlKey && !e.altKey && !e.metaKey &&
            document.activeElement !== elements.terminalInput &&
            e.key.length === 1) {
            elements.terminalInput.focus();
        }
    });

    // Window controls (decorative)
    document.querySelector('.control.close')?.addEventListener('click', () => {
        addOutput('💡 This is a web UI. Use your browser to close.', 'info');
    });
}

// ==================
// INITIALIZATION
// ==================
async function init() {
    // Set platform
    const platform = navigator.platform.includes('Win') ? 'Windows' :
        navigator.platform.includes('Mac') ? 'macOS' : 'Linux';
    elements.currentPlatform.textContent = platform;

    // Try to get actual path from URL params or use default
    state.currentPath = 'C:\\Users\\Varun\\Pictures\\nlsh';
    elements.currentPath.textContent = state.currentPath;

    // Check Ollama connection and fetch current path
    await checkOllamaConnection();
    await fetchCurrentPath();

    // Set up periodic connection check
    setInterval(checkOllamaConnection, 10000);

    // Init event listeners
    initEventListeners();

    // Focus input
    elements.terminalInput.focus();

    // Hide hints after 10 seconds
    setTimeout(() => {
        elements.hintsPanel.classList.add('hidden');
    }, 15000);

    console.log('🧠 NLSH Web UI initialized');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
