import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);
const router = Router();

function isValidYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    return (
      hostname === "youtube.com" ||
      hostname === "youtu.be" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com"
    );
  } catch {
    return false;
  }
}

router.post("/download", async (req, res) => {
  const body = req.body as { url?: unknown };
  if (!body.url || typeof body.url !== "string") {
    res.status(400).json({ error: "Invalid request. Please provide a valid URL." });
    return;
  }

  const { url } = body;

  if (!isValidYouTubeUrl(url)) {
    res.status(400).json({ error: "Only YouTube URLs are supported." });
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytmp3-"));
  const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");

  try {
    req.log.info({ url }, "Starting YouTube audio download");

    // Use yt-dlp to extract audio as mp3
    const ytdlpCmd = [
      "yt-dlp",
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--no-playlist",
      "--max-filesize", "100m",
      "--output", JSON.stringify(outputTemplate),
      "--no-warnings",
      "--restrict-filenames",
      JSON.stringify(url),
    ].join(" ");

    await execAsync(ytdlpCmd, { timeout: 120000 });

    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".mp3"));

    if (files.length === 0) {
      res.status(500).json({ error: "Failed to convert audio. The video may be unavailable or restricted." });
      return;
    }

    const mp3File = path.join(tmpDir, files[0]);
    const filename = files[0];

    req.log.info({ filename }, "Sending MP3 file");

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", fs.statSync(mp3File).size);

    const fileStream = fs.createReadStream(mp3File);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    fileStream.on("error", (err) => {
      req.log.error({ err }, "Error streaming file");
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to send file." });
      }
    });
  } catch (err: unknown) {
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const errorMessage = err instanceof Error ? err.message : String(err);
    req.log.error({ err, url }, "Download failed");

    if (errorMessage.includes("Private video") || errorMessage.includes("This video is private")) {
      res.status(400).json({ error: "This video is private and cannot be downloaded." });
    } else if (errorMessage.includes("Video unavailable") || errorMessage.includes("not available")) {
      res.status(400).json({ error: "This video is unavailable or has been removed." });
    } else if (errorMessage.includes("age") || errorMessage.includes("Sign in")) {
      res.status(400).json({ error: "This video requires age verification and cannot be downloaded." });
    } else if (errorMessage.includes("copyright") || errorMessage.includes("blocked")) {
      res.status(400).json({ error: "This video is blocked or restricted due to copyright." });
    } else if (errorMessage.includes("maxfilesize") || errorMessage.includes("max-filesize")) {
      res.status(400).json({ error: "This video is too large to convert (max 100MB)." });
    } else {
      res.status(500).json({ error: "Failed to download audio. Please check the URL and try again." });
    }
  }
});

router.get("/info", async (req, res) => {
  const url = req.query["url"] as string;

  if (!url) {
    res.status(400).json({ error: "URL is required." });
    return;
  }

  if (!isValidYouTubeUrl(url)) {
    res.status(400).json({ error: "Only YouTube URLs are supported." });
    return;
  }

  try {
    const { stdout } = await execAsync(
      `yt-dlp --dump-json --no-playlist --no-warnings ${JSON.stringify(url)}`,
      { timeout: 30000 }
    );

    const info = JSON.parse(stdout);

    res.json({
      title: info.title ?? "Unknown Title",
      duration: info.duration ?? 0,
      thumbnail: info.thumbnail ?? null,
      channel: info.uploader ?? null,
      viewCount: info.view_count ?? null,
    });
  } catch (err: unknown) {
    req.log.error({ err, url }, "Info fetch failed");
    res.status(400).json({ error: "Could not fetch video information. The video may be unavailable." });
  }
});

export default router;
