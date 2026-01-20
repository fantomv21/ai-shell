#!/usr/bin/env node
import { Command } from "commander";
import { generateCommand } from "./commands/generate.js";
import { startShell } from "./shell.js";

// Check if we have any arguments (beyond node and script path)
const hasArgs = process.argv.length > 2;

if (!hasArgs) {
  // No arguments - start interactive shell directly (bypass Commander)
  startShell("mistral");
} else {
  // Has arguments - use Commander for parsing
  const program = new Command();

  program
    .name("nlsh")
    .description("Natural language to shell commands (Ollama only)")
    .argument("[prompt]", "What you want to do (omit for interactive shell)")
    .option("-e, --execute", "Execute the generated command")
    .option("-m, --model <name>", "Ollama model", "mistral")
    .action(async (prompt, options) => {
      if (!prompt) {
        startShell(options.model);
      } else {
        await generateCommand(prompt, options);
      }
    });

  program.parse();
}
