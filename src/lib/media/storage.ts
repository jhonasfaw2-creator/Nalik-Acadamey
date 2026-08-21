import fs from "fs/promises";
import path from "path";

// Local media storage directory
const MEDIA_DIR = path.join(process.cwd(), "public", "media");

// Ensure the media directory exists
async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Ensure root media dir exists on startup
ensureDir(MEDIA_DIR);

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
  created_at: string;
}

// Upload a file to local storage
export async function uploadFile(
  file: File,
  folder: string
): Promise<{ url: string; path: string; size: number; type: string; filename: string }> {
  const safeFolder = ["hero", "about", "our-work", "uploads"].includes(folder)
    ? folder
    : "uploads";

  const folderPath = path.join(MEDIA_DIR, safeFolder);
  await ensureDir(folderPath);

  const ext = file.name.split(".").pop() || "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(folderPath, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  const relativePath = `media/${safeFolder}/${filename}`;

  return {
    url: `/${relativePath}`,
    path: relativePath,
    size: file.size,
    type: file.type,
    filename: file.name,
  };
}

// Delete a file from local storage
export async function deleteFile(filePath: string): Promise<void> {
  const fullPath = path.join(process.cwd(), "public", filePath);
  try {
    await fs.access(fullPath);
    await fs.unlink(fullPath);
  } catch {
    // File may not exist, that's ok
  }
}

// Replace a file at the given path
export async function replaceFile(
  file: File,
  existingPath: string
): Promise<{ url: string; path: string; size: number; type: string }> {
  const fullPath = path.join(process.cwd(), "public", existingPath);

  // Ensure directory exists
  const dir = path.dirname(fullPath);
  await ensureDir(dir);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  return {
    url: `/${existingPath}`,
    path: existingPath,
    size: file.size,
    type: file.type,
  };
}

// List files in a folder
export async function listFiles(folder: string): Promise<MediaFile[]> {
  const safeFolder = ["hero", "about", "our-work", "uploads"].includes(folder)
    ? folder
    : "";

  const folderPath = safeFolder
    ? path.join(MEDIA_DIR, safeFolder)
    : MEDIA_DIR;

  try {
    await ensureDir(folderPath);
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    const files: MediaFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filePath = safeFolder
        ? `${folderPath}/${entry.name}`
        : `${MEDIA_DIR}/${entry.name}`;

      const stat = await fs.stat(filePath);
      const relativePath = safeFolder
        ? `media/${safeFolder}/${entry.name}`
        : `media/${entry.name}`;

      // Determine MIME type from extension
      const ext = entry.name.split(".").pop()?.toLowerCase() || "";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        svg: "image/svg+xml",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
      };

      files.push({
        id: relativePath,
        name: entry.name,
        path: relativePath,
        url: `/${relativePath}`,
        size: stat.size,
        type: mimeMap[ext] || "application/octet-stream",
        created_at: stat.birthtime.toISOString(),
      });
    }

    // Sort by creation time, newest first
    files.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return files;
  } catch {
    return [];
  }
}
