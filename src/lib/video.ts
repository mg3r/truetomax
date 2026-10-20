import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

async function ffmpegPath() {
  const mod = (await import("ffmpeg-static")) as unknown as { default?: string | null };
  const p = mod.default;
  if (!p) throw new Error("ffmpeg isn't available here.");
  return p;
}

export type Frame = { at: number; mediaType: "image/jpeg"; data: string };

/**
 * Watch a video the way a person skims one: download it, then take frames spread across the whole thing
 * (more for longer videos, always including the opening). Sound isn't included.
 */
export async function framesOf(url: string, { max = 12 } = {}): Promise<{ duration: number | null; frames: Frame[] }> {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return { duration: null, frames: [] };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 150_000_000) return { duration: null, frames: [] };
    const file = path.join(dir, "in.mp4");
    await writeFile(file, buf);
    const ffmpeg = await ffmpegPath();

    // ffmpeg prints the length while it reads the file (and exits with an error, since there's no output).
    const probe = await run(ffmpeg, ["-hide_banner", "-i", file], { timeout: 20000 }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe.stderr ?? "");
    const duration = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
    const len = duration ?? 20;
    // About one frame every 2 seconds, at least 4, at most `max`: evenly spaced, starting with the opening.
    const count = Math.max(4, Math.min(max, Math.round(len / 2)));
    const times = Array.from({ length: count }, (_, i) => Math.max(0, Math.min(len - 0.15, i === 0 ? 0.3 : (i * len) / count)));

    await Promise.all(
      times.map((t, i) =>
        run(
          ffmpeg,
          ["-hide_banner", "-loglevel", "error", "-ss", t.toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "6", path.join(dir, `f${String(i).padStart(2, "0")}.jpg`)],
          { timeout: 20000 }
        ).catch(() => null)
      )
    );
    const names = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
    const frames: Frame[] = [];
    for (const n of names) {
      const i = Number(n.slice(1, 3));
      frames.push({ at: Math.round(times[i] * 10) / 10, mediaType: "image/jpeg", data: (await readFile(path.join(dir, n))).toString("base64") });
    }
    return { duration, frames };
  } catch (e) {
    console.error("framesOf", e);
    return { duration: null, frames: [] };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
