// POST /api/transcribe   { audio: "<base64>", mime: "audio/webm" }
// ->                     { text: "..." }
//
// Backup speech-to-text for browsers without built-in speech recognition (e.g. Firefox).
// Chrome, Edge and Safari normally never call this; they transcribe in the browser.
import { getProvider, readJson, friendlyError } from "./_lib.js";

const MAX_BYTES = 4 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method", message: "Use POST." });

  const provider = getProvider();
  if (!provider) return res.status(500).json({ error: "not_configured", message: "This bot isn't connected to an AI model yet." });
  if (!provider.sttModel) {
    return res.status(501).json({ error: "stt_unsupported", message: "Voice input isn't available in this browser. Please type your question, or open this page in Chrome." });
  }

  let body;
  try { body = await readJson(req); } catch { return res.status(400).json({ error: "bad_json", message: "Invalid request." }); }

  const b64 = typeof body?.audio === "string" ? body.audio : "";
  const mime = (typeof body?.mime === "string" ? body.mime : "audio/webm").split(";")[0].trim().toLowerCase();
  if (!b64) return res.status(400).json({ error: "empty", message: "No audio received." });

  const buf = Buffer.from(b64, "base64");
  if (buf.length < 1000) return res.status(400).json({ error: "empty", message: "I didn't catch anything. Try again." });
  if (buf.length > MAX_BYTES) return res.status(413).json({ error: "too_long", message: "That recording was too long. Keep it under 30 seconds." });

  const ext = mime.includes("mp4") || mime.includes("m4a") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";

  try {
    const form = new FormData();
    form.append("file", new Blob([buf], { type: mime }), `question.${ext}`);
    form.append("model", provider.sttModel);
    form.append("language", "en");
    form.append("response_format", "json");

    const r = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(25000),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const err = new Error(data?.error?.message || `transcription failed (${r.status})`);
      err.status = r.status;
      throw err;
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ text: String(data?.text || "").trim() });
  } catch (err) {
    console.error("transcribe error:", err?.status, err?.message);
    const f = friendlyError(err);
    return res.status(f.code).json({ error: f.error, message: f.message });
  }
}
