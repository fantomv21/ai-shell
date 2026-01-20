import { exec } from "child_process";
import readline from "readline";

export async function confirmAndRun(cmd: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer: string = await new Promise(res =>
    rl.question(`\nRun this command?\n${cmd}\n(y/n): `, res)
  );

  rl.close();

  if (answer.toLowerCase() !== "y") {
    console.log("❌ Cancelled");
    return;
  }

  exec(cmd, (err, stdout, stderr) => {
    if (err) console.error(stderr);
    else console.log(stdout);
  });
}
