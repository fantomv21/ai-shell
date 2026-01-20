const BLOCKED_PATTERNS = [
  "rm -rf /",
  "mkfs",
  "dd if=",
  ":(){",
  "shutdown",
  "reboot"
];

export function isSafe(command: string): boolean {
  return !BLOCKED_PATTERNS.some(p =>
    command.toLowerCase().includes(p)
  );
}
