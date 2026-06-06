import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

export interface ProjectPaths {
  root: string;
  mapsDir: string;
  imagesDir: string;
  hypeDir: string;
  manifestFile: string;
  customDir: string;
}

const CWD = process.cwd();

export function getProjectPaths(project: string): ProjectPaths {
  const root = path.join(CWD, "export", project);
  return {
    root,
    mapsDir: path.join(root, "maps"),
    imagesDir: path.join(root, "images"),
    hypeDir: path.join(root, "hype"),
    manifestFile: path.join(root, "manifest.json"),
    customDir: path.join(CWD, "custom", project),
  };
}

export async function ensureProjectDirs(paths: ProjectPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.root, { recursive: true }),
    mkdir(paths.mapsDir, { recursive: true }),
    mkdir(paths.imagesDir, { recursive: true }),
    mkdir(paths.hypeDir, { recursive: true }),
    mkdir(paths.customDir, { recursive: true }),
  ]);
}

export async function listExistingProjects(): Promise<string[]> {
  const customDir = path.join(CWD, "custom");
  await mkdir(customDir, { recursive: true });
  const entries = await readdir(customDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}
