import { basename, dirname, resolve } from "node:path";
import { FileWorldRepository } from "./FileWorldRepository.js";

function defaultDataFile(): string {
  const configuredPath = process.env.LAST_SURVIVOR_DATA_FILE;
  if (configuredPath) {
    return resolve(configuredPath);
  }

  const workingDirectory = process.cwd();
  const runningFromServerWorkspace = basename(workingDirectory) === "server"
    && basename(dirname(workingDirectory)) === "apps";

  return runningFromServerWorkspace
    ? resolve(workingDirectory, "data", "worlds.json")
    : resolve(workingDirectory, "apps", "server", "data", "worlds.json");
}

export const worldRepository = new FileWorldRepository(defaultDataFile());
