// POST /api/chat   { messages: [{ role: "user" | "assistant", content: "..." }, ...] }
// ->               { reply: "..." }
import { SYSTEM_PROMPT } from "../persona.js";
import { getProvider, readJson, chat, friendlyError } from "./_lib.js";

const MAX_TURNS = 12;      // how much conversation history is sent to the model
const MAX_CHARS = 1200;    // per message

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method", message: "Use POST." });

  const provider = getProvider();
  if (!provider) {
    return res.status(500).json({
      error: "not_configured",
      message: "This bot isn't connected to an AI model yet. The owner needs to add an API key (for example GROQ_API_KEY) in the hosting settings and redeploy.",
    });
  }

  let body;
  try { body = await readJson(req); } catch { return res.status(400).json({ error: "bad_json", message: "Invalid request." }); }

  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_TURNS);

  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "empty", message: "I didn't get a question." });
  }

  try {
    const reply = await chat(provider, [{ role: "system", content: SYSTEM_PROMPT }, ...messages]);
    if (!reply) throw new Error("empty reply");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("chat error:", err?.status, err?.message);
    const f = friendlyError(err);
    return res.status(f.code).json({ error: f.error, message: f.message });
  }
}
