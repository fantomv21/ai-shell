# 🧠 NL Shell (nlsh) - Feature Report

**Project:** Natural Language to Shell Commands with Ollama AI
**Created:** January 20, 2026
**Status:** Active Development

---

## 📋 Table of Contents
1. [Core Features](#core-features)
2. [Installation & Setup](#installation--setup)
3. [Usage Examples](#usage-examples)
4. [Advanced Features](#advanced-features)

---

## 🎯 Core Features

### 1. **Natural Language Command Generation**
Converts human language to executable shell commands automatically.

**Examples:**
```bash
nlsh ❯ install pandas
→ pip install pandas

nlsh ❯ create file test.py
→ New-Item test.py -ItemType File -Force

nlsh ❯ create folder data
→ New-Item data -ItemType Directory -Force

nlsh ❯ go to src
→ cd src

nlsh ❯ show files
→ dir (or ls on Linux)
```

---

### 2. **Git Integration** 🌱
Full natural language git command support.

**Examples:**
```bash
nlsh ❯ git status
→ git status

nlsh ❯ commit all changes with message 'initial commit'
→ git add .; git commit -m "initial commit"

nlsh ❯ create branch feature-x
→ git checkout -b feature-x

nlsh ❯ switch to main branch
→ git checkout main

nlsh ❯ push changes
→ git push

nlsh ❯ pull latest
→ git pull

nlsh ❯ show commit history
→ git log --oneline -10

nlsh ❯ gst
📁 Branch: main
Status:
 M src/shell.ts
 M package.json
```

---

### 3. **Python Command Execution** 🐍
Run Python scripts and code directly from natural language.

**Examples:**
```bash
nlsh ❯ python print hello world
→ python -c "print('hello world')"
Hello world

nlsh ❯ python print(2+2)
→ python -c "print(2+2)"
4

nlsh ❯ run script.py
→ python script.py

nlsh ❯ python import math; print(math.pi)
→ python -c "import math; print(math.pi)"
3.14159...

nlsh ❯ execute python code print('test')
→ python -c "print('test')"
test
```

---

### 4. **Package Installation** 📦
Intelligent package manager detection and installation.

**Examples:**
```bash
nlsh ❯ install numpy
→ pip install numpy
Requirement already satisfied: numpy...

nlsh ❯ install express
→ npm install express
added 50 packages...

nlsh ❯ install pandas
→ pip install pandas

nlsh ❯ install django
→ pip install django

nlsh ❯ install flask
→ pip install flask
```

---

### 5. **File & Folder Operations** 📁
Create and navigate files and directories.

**Examples:**
```bash
nlsh ❯ open file config.json
→ notepad config.json

nlsh ❯ create file .gitignore
→ New-Item .gitignore -ItemType File -Force

nlsh ❯ create folder src
→ New-Item src -ItemType Directory -Force

nlsh ❯ navigate to Documents
→ cd Documents
📁 C:\Users\Varun\Documents
```

---

### 6. **AI Chat Mode** 🤖
Ask questions and get explanations without executing commands.

**Examples:**
```bash
nlsh ❯ chat
🤖 AI Chat Mode Started
Type 'back' or 'exit' to return to command mode

chat ❯ how do I deploy to AWS?
⏳ Thinking...
AWS deployment involves several steps: 1) Create an AWS account, 2) Set up EC2 instances or use services like Beanstalk, 3) Configure security groups, 4) Deploy your application...

chat ❯ explain what REST API is
A REST API is an architectural style that uses HTTP requests to perform CRUD operations on resources. It uses standard methods like GET, POST, PUT, DELETE...

chat ❯ give me npm shortcuts
Here are useful npm shortcuts:
- npm i = npm install
- npm r = npm remove
- npm t = npm test
- npm s = npm start

chat ❯ how to fix CORS errors?
CORS errors occur when a browser blocks requests. Solutions: 1) Add CORS headers to backend, 2) Use middleware like cors(), 3) Configure proxy in development...

chat ❯ back
👈 Returning to command mode

nlsh ❯
```

---

### 7. **Directory Navigation** 
Quick navigation with built-in commands and automatic path handling.

**Examples:**
```bash
nlsh ❯ path
📁 C:\Users\Varun\Documents\RVCE\nlsh

nlsh ❯ pwd
📁 C:\Users\Varun\Documents\RVCE\nlsh

nlsh ❯ cd ..
📁 Changed directory to: C:\Users\Varun\Documents\RVCE

nlsh ❯ move to nlsh
→ cd nlsh
📂 Changed directory to: C:\Users\Varun\Documents\RVCE\nlsh
```

---

### 8. **Git Status Display** 
Quick access to git information.

**Examples:**
```bash
nlsh ❯ gitstatus
🌱 Branch: main

Status:
 M src/shell.ts
 M src/commands/generate.ts
?? dist/
```

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+ 
- Python 3.8+ (for Python commands)
- Git (for git integration)
- Ollama running locally on port 11434

### Install nlsh
```bash
cd nlsh
npm install
npm run build
npm start
```

### Run Interactive Shell
```bash
node dist/cli.js
```

### Run Single Command
```bash
node dist/cli.js "install pandas" -e
node dist/cli.js "create file test.py" -e
node dist/cli.js "commit all with message 'fix'" -e
```

---

## 💡 Usage Examples

### Scenario 1: Start New Project
```bash
$ node dist/cli.js
[Shell starts with git branch info]

nlsh ❯ create folder src
→ New-Item src -ItemType Directory -Force

nlsh ❯ create file index.py
→ New-Item index.py -ItemType File -Force

nlsh ❯ go to src
→ cd src
📂 Changed directory to: C:\Users\Varun\Documents\RVCE\nlsh\src

nlsh ❯ create file main.py
→ New-Item main.py -ItemType File -Force

nlsh ❯ commit all with message 'initial project setup'
→ git add .; git commit -m "initial project setup"
```

### Scenario 2: Python Development
```bash
nlsh ❯ install pandas numpy matplotlib
→ pip install pandas numpy matplotlib

nlsh ❯ python import pandas as pd; print(pd.__version__)
→ python -c "import pandas as pd; print(pd.__version__)"
2.0.3

nlsh ❯ run analysis.py
→ python analysis.py
[Python script executes]

nlsh ❯ commit all with message 'add data analysis'
→ git add .; git commit -m "add data analysis"
```

### Scenario 3: Get Help
```bash
nlsh ❯ help
[Shows all available commands]

nlsh ❯ chat
chat ❯ what's the difference between git merge and rebase?
[Ollama explains the difference]

chat ❯ how do I create a virtual environment?
[Ollama provides Python venv instructions]

chat ❯ back
nlsh ❯
```

### Scenario 4: Git Workflow
```bash
nlsh ❯ gst
🌱 Branch: main
Status: Working tree clean

nlsh ❯ create branch feature/new-ui
→ git checkout -b feature/new-ui

nlsh ❯ python print('hello')
→ python -c "print('hello')"
hello

nlsh ❯ commit all with message 'add new UI component'
→ git add .; git commit -m "add new UI component"

nlsh ❯ push changes
→ git push

nlsh ❯ gst
🌱 Branch: feature/new-ui
Status: [working tree clean]
```

---

## 🎨 Advanced Features

### Colorized Output
All output is color-coded for clarity:
- **Cyan/Blue** - Headers, prompts, info
- **Green** - Success messages, generated commands
- **Yellow** - Warnings, thinking status
- **Red** - Errors, blocked commands
- **Magenta** - Git information, chat mode

### Autocomplete with Suggestions
Press **TAB** for autocomplete suggestions:
```
nlsh ❯ inst[TAB]
→ Shows: "install ", "install pandas", "install numpy", ...

nlsh ❯ create f[TAB]
→ Shows: "create file ", "create folder"

nlsh ❯ git st[TAB]
→ Shows: "git status"
```

**Inline Gray Suggestions:**
As you type, see suggestions in gray:
```
nlsh ❯ inst█all pandas
       ^^^^ (gray suggestion)
```

### Safety Features
- Commands over 200 characters rejected
- Complex/suspicious commands blocked
- Blocked patterns: `rm -rf /`, `mkfs`, `dd if=`, `reboot`, etc.
- User must enable `-e` flag to auto-execute

### Cross-Platform Support
- **Windows:** Uses PowerShell with proper syntax (`;` instead of `&&`)
- **Linux/Mac:** Uses bash
- Automatic shell detection and optimization

---

## 🚀 Command Categories

### Navigation Commands
- `cd`, `go to`, `move to` → Change directory
- `path`, `pwd`, `cwd` → Show current directory

### File Operations
- `create file X` → Create file
- `create folder X` → Create folder
- `open file X` → Open file in editor

### Package Management
- `install X` → Install Python/Node package

### Python
- `python [code]` → Run Python code
- `run [script]` → Run Python script

### Git
- `git status` → Show git status
- `commit all with message X` → Commit changes
- `create branch X` → Create new branch
- `switch to branch X` → Switch branches
- `push changes` → Push to remote
- `pull latest` → Pull from remote
- `show commit history` → Show git log

### Chat Mode
- `chat`, `enter chat` → Enter chat mode
- Ask any question
- `back`, `exit`, `quit` → Return to command mode

### Built-in Commands
- `help` → Show help menu
- `exit`, `quit` → Exit shell
- `gst`, `gitstatus` → Show git status

---

## 📊 Feature Summary

| Feature | Status | Platform | Example |
|---------|--------|----------|---------|
| Natural Language Commands | ✅ | Win/Mac/Linux | `install pandas` |
| Git Integration | ✅ | All | `commit all with message 'fix'` |
| Python Execution | ✅ | All | `python print(2+2)` |
| Package Installation | ✅ | All | `install express` |
| File Operations | ✅ | All | `create file test.py` |
| AI Chat Mode | ✅ | All | `chat` |
| Colorized Output | ✅ | All | Auto |
| Autocomplete | ✅ | All | TAB key |
| Safety Checks | ✅ | All | Auto |
| Cross-Platform | ✅ | Win/Mac/Linux | Auto |

---

## 📝 Technical Stack

- **Language:** TypeScript
- **AI Engine:** Ollama (mistral/llama2)
- **CLI:** Commander.js
- **Colors:** Chalk
- **Shell Execution:** Node.js child_process
- **Build:** TypeScript compiler (tsc)

---

## 🔄 Project Structure

```
nlsh/
├── src/
│   ├── cli.ts              # Entry point
│   ├── shell.ts            # Main REPL loop
│   ├── commands/
│   │   └── generate.ts     # Single command mode
│   ├── llm/
│   │   └── ollama.ts       # AI API calls
│   ├── safety/
│   │   └── validator.ts    # Safety checks
│   └── utils/
│       ├── git.ts          # Git utilities
│       ├── os.ts           # OS detection
│       └── exec.ts         # Command execution
├── dist/                   # Compiled JavaScript
├── package.json            # Dependencies
├── tsconfig.json          # TypeScript config
└── .gitignore             # Git ignore rules
```

---

## 📈 Next Steps (Planned Features)

- Command history with persistence
- Execution time tracking
- Config file (.nlshrc) support
- Smart error suggestions
- Web search integration
- Code scaffolding
- Docker integration
- Database CLI
- Session recording & replay

---

## ✨ Report Generated
**Date:** January 20, 2026
**Version:** 1.0.0
**Status:** Production Ready

---

**Get Started:**
```bash
npm run build
npm start
```

**Try it now:**
```
nlsh ❯ help
nlsh ❯ chat
nlsh ❯ create file example.py
nlsh ❯ python print('NL Shell is awesome!')
```

🚀 **Happy coding with NL Shell!**
