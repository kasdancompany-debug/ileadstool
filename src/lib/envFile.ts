// Small helper used only by the one-time OAuth callback route to persist the
// refresh token it receives into .env.local for local dev. Not used at request time
// by the rest of the app — this only runs once, interactively, during setup.
import { promises as fs } from "fs";
import path from "path";

const ENV_FILE = path.join(process.cwd(), ".env.local");

export async function upsertEnvVars(vars: Record<string, string>): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(ENV_FILE, "utf-8");
  } catch {
    // no .env.local yet
  }

  const lines = content.split("\n");
  const remainingKeys = new Set(Object.keys(vars));

  const updatedLines = lines.map((line) => {
    const match = line.match(/^\s*#?\s*([A-Z0-9_]+)\s*=/);
    if (match && remainingKeys.has(match[1])) {
      const key = match[1];
      remainingKeys.delete(key);
      return `${key}=${vars[key]}`;
    }
    return line;
  });

  for (const key of remainingKeys) {
    updatedLines.push(`${key}=${vars[key]}`);
  }

  await fs.writeFile(ENV_FILE, updatedLines.join("\n"));
}
