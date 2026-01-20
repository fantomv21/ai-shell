import os from "os";

export function getShell(): string {
  if (process.platform === "win32") return "PowerShell";
  return "bash";
}
