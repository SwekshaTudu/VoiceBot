// Shared helpers for the API functions. Files starting with "_" are not exposed as endpoints.
//
// The API key is read from an environment variable on the server, so visitors never
// see it or have to enter one. Any OpenAI-compatible provider works:
//
//   GROQ_API_KEY     -> Groq (free tier)            default model: llama-3.3-70b-versatile
//   OPENAI_API_KEY   -> OpenAI (ChatGPT API)        default model: gpt-4o-mini
//   GEMINI_API_KEY   -> Google Gemini (free tier)   default model: gemini-flash-latest
//
// Optional overrides: LLM_MODEL, LLM_BASE_URL, LLM_API_KEY, STT_MODEL.

const PROVIDERS = [
  {
    name: "groq",
    env: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    sttModel: "whisper-large-v3-turbo",
  },
  {
    name: "openai",
    env: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    sttModel: "whisper-1",
  },
  {
    name: "gemini",
    env: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-flash-latest",
    sttModel: null, // no transcription endpoint; the browser's own speech recognition is used
  },
];

export function getProvider() {
  const env = process.env;
  let p = PROVIDERS.find((x) => env[x.env]);
  if (!p && env.LLM_API_KEY && env.LLM_BASE_URL) {
    p = { name: "custom", env: "LLM_API_KEY", model: null, sttModel: null };
  }
  if (!p) return null;
  return {
    name: p.name,
    apiKey: (env.LLM_API_KEY || env[p.env]).trim(),
    baseUrl: (env.LLM_BASE_URL || p.baseUrl).replace(/\/+$/, ""),
    model: env.LLM_MODEL || p.model,
    sttModel: env.STT_MODEL || p.sttModel,
  };
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function post(provider, path, body, timeoutMs = 25000) {
  const r = await fetch(`${provider.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  const errMsg = data?.error?.message || data?.[0]?.error?.message || (r.ok ? "" : text.slice(0, 300));
  return { ok: r.ok, status: r.status, data, errMsg };
}

// If the configured model has been retired, pick a sensible chat model from the provider's list.
async function pickFallbackModel(provider, not) {
  try {
    const r = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    const ids = (data.data || [])
      .map((m) => String(m.id || "").replace(/^models\//, ""))
      .filter((id) => id && id !== not)
      .filter((id) => !/whisper|tts|speech|audio|guard|embed|image|vision|moderation|realtime|transcribe/i.test(id));
    const prefs = [/llama-3\.3-70b/i, /gpt-oss-120b/i, /llama.*70b/i, /gpt-4o-mini/i, /gemini.*flash/i, /llama/i, /gpt/i];
    for (const re of prefs) {
      const hit = ids.find((id) => re.test(id));
      if (hit) return hit;
    }
    return ids[0] || null;
  } catch {
    return null;
  }
}

export async function chat(provider, messages) {
  const full = (model) => ({ model, messages, temperature: 0.6, max_completion_tokens: 350 });
  let model = provider.model;

  let res = model ? await post(provider, "/chat/completions", full(model)) : { ok: false, status: 404, errMsg: "no model" };

  // Model missing or retired -> try another one from the provider's list.
  if (!res.ok && (res.status === 404 || /model/i.test(res.errMsg || "")) && res.status !== 401 && res.status !== 429) {
    const alt = await pickFallbackModel(provider, model);
    if (alt) {
      model = alt;
      res = await post(provider, "/chat/completions", full(model));
    }
  }
  // Some models reject optional parameters -> retry with the bare minimum.
  if (!res.ok && res.status === 400) {
    res = await post(provider, "/chat/completions", { model, messages });
  }
  if (!res.ok) {
    const err = new Error(res.errMsg || `LLM request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const raw = res.data?.choices?.[0]?.message?.content;
  const text = Array.isArray(raw) ? raw.map((p) => p?.text || "").join("") : String(raw || "");
  return cleanForSpeech(text);
}

export function cleanForSpeech(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<<EDIT[^>]*>>/g, "")
    .replace(/[*_#`]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function friendlyError(err) {
  const s = err?.status;
  if (s === 401 || s === 403) return { code: 500, error: "bad_key", message: "The site's AI key was rejected. The owner needs to check the API key in the hosting settings." };
  if (s === 429) return { code: 429, error: "busy", message: "I'm getting a lot of questions right now. Give me a few seconds and ask again." };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return { code: 504, error: "timeout", message: "That took too long on my side. Please ask again." };
  return { code: 502, error: "upstream", message: "Something went wrong on my side. Please ask again." };
}
