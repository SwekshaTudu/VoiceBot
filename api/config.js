// GET /api/config -> { name, tagline, ready }
// Lets the page show your name and tagline from persona.js, and tells it whether a key is set.
import { NAME, TAGLINE } from "../persona.js";
import { getProvider } from "./_lib.js";

export default function handler(req, res) {
  const p = getProvider();
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ name: NAME, tagline: TAGLINE, ready: Boolean(p), voiceBackup: Boolean(p?.sttModel) });
}
