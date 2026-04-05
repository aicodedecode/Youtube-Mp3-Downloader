import { useState, useRef } from "react";
import { Music2, Download, Loader2, AlertCircle, CheckCircle2, Youtube, Clock, Eye } from "lucide-react";

type Status = "idle" | "fetching-info" | "downloading" | "success" | "error";

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string | null;
  channel: string | null;
  viewCount: number | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

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

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [progress, setProgress] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const handleFetchInfo = async (inputUrl: string) => {
    if (!inputUrl.trim()) return;
    if (!isValidYouTubeUrl(inputUrl.trim())) {
      setError("Please enter a valid YouTube URL.");
      setVideoInfo(null);
      return;
    }

    setError(null);
    setVideoInfo(null);
    setStatus("fetching-info");

    try {
      const params = new URLSearchParams({ url: inputUrl.trim() });
      const res = await fetch(`/api/info?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not fetch video info.");
        setStatus("error");
        return;
      }

      setVideoInfo(data);
      setStatus("idle");
    } catch {
      setError("Failed to connect to server.");
      setStatus("error");
    }
  };

  const handleUrlChange = (val: string) => {
    setUrl(val);
    setError(null);
    setVideoInfo(null);
    setStatus("idle");
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      await handleFetchInfo(text);
    } catch {
      // clipboard access denied, just let user type
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Please enter a YouTube URL.");
      return;
    }

    if (!isValidYouTubeUrl(trimmed)) {
      setError("Please enter a valid YouTube URL (youtube.com or youtu.be).");
      return;
    }

    setError(null);
    setStatus("downloading");
    setProgress("Processing video...");

    abortRef.current = new AbortController();

    try {
      const progressMessages = [
        "Fetching video info...",
        "Extracting audio stream...",
        "Converting to MP3...",
        "Finalizing file...",
      ];
      let msgIdx = 0;
      const progressInterval = setInterval(() => {
        msgIdx = Math.min(msgIdx + 1, progressMessages.length - 1);
        setProgress(progressMessages[msgIdx]);
      }, 4000);

      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
        signal: abortRef.current.signal,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Download failed. Please try again.");
        setStatus("error");
        return;
      }

      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      let filename = "audio.mp3";
      const match = contentDisposition.match(/filename="([^"]+)"/);
      if (match?.[1]) filename = match[1];

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      setStatus("success");
      setProgress("");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("idle");
        setProgress("");
        return;
      }
      setError("Failed to download. Please check your connection and try again.");
      setStatus("error");
      setProgress("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleFetchInfo(url);
    }
  };

  const isLoading = status === "fetching-info" || status === "downloading";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(ellipse, hsl(263 70% 62%) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 mb-5 shadow-lg">
            <Music2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
            YouTube to MP3
          </h1>
          <p className="text-muted-foreground text-sm">
            Paste a YouTube link and download the audio as an MP3 file
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="youtube-url">
                YouTube URL
              </label>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="youtube-url"
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onBlur={() => { if (url.trim()) handleFetchInfo(url); }}
                    onKeyDown={handleKeyDown}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm transition-all"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isLoading}
                  className="px-4 py-3 rounded-xl border border-secondary-border bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Paste
                </button>
              </div>
            </div>

            {/* Video Info Preview */}
            {status === "fetching-info" && (
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Fetching video info...</span>
              </div>
            )}

            {videoInfo && status !== "fetching-info" && (
              <div className="flex gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                {videoInfo.thumbnail && (
                  <img
                    src={videoInfo.thumbnail}
                    alt="thumbnail"
                    className="w-20 h-14 object-cover rounded-lg shrink-0 border border-border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate leading-snug">{videoInfo.title}</p>
                  {videoInfo.channel && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{videoInfo.channel}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {videoInfo.duration > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDuration(videoInfo.duration)}
                      </span>
                    )}
                    {videoInfo.viewCount != null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        {formatViews(videoInfo.viewCount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Success */}
            {status === "success" && !error && (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <p className="text-sm text-green-400">Your MP3 has been downloaded successfully!</p>
              </div>
            )}

            {/* Download progress */}
            {status === "downloading" && (
              <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-xl">
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                <p className="text-sm text-primary">{progress || "Processing..."}</p>
              </div>
            )}

            {/* Download Button */}
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:opacity-80 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              {status === "downloading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Converting to MP3...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download MP3
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info footer */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Supports youtube.com and youtu.be links. Max file size: 100MB.
          </p>
          <p className="text-xs text-muted-foreground">
            For personal use only. Respect copyright laws in your region.
          </p>
        </div>
      </div>
    </div>
  );
}
