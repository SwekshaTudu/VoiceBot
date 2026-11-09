# Voice bot: "Talk to me"

A web page where anyone can tap a mic, ask an interview question out loud, and hear an answer in my voice-persona. No sign-in, no API key entry, nothing to install.

## How it works

- `public/index.html`: the whole page. Listens with the browser's speech recognition, speaks with the browser's text-to-speech, and always offers a text box as a fallback.
- `api/chat.js`: a small server function that adds the persona and calls the AI model. The API key lives here as a server environment variable, so visitors never see it.
- `api/transcribe.js`: backup speech-to-text for browsers with no built-in recognition (e.g. Firefox).
- `persona.js`: **everything the bot knows about me, in plain English. This is the file to edit.**

## Deploy (about 10 minutes, free)

### 1. Make the answers yours
Open `persona.js` and rewrite every section marked `<<EDIT>>` in your own words.

### 2. Get a free API key
Go to https://console.groq.com, sign in, open **API Keys**, create a key and copy it (it starts with `gsk_`).

Prefer OpenAI or Gemini? Use an OpenAI key with the variable name `OPENAI_API_KEY`, or a Google AI Studio key with `GEMINI_API_KEY`. Nothing else changes.

### 3. Put the code on GitHub
1. On https://github.com create a new repository (private is fine).
2. On the empty repo page click **uploading an existing file**.
3. Unzip this project and drag *the contents of the folder* (`api`, `public`, `persona.js`, `package.json`, `README.md`) into the page. `package.json` must end up at the top level of the repo, not inside a subfolder.
4. Commit.

### 4. Deploy on Vercel
1. On https://vercel.com sign in with GitHub, then **Add New → Project** and import the repo.
2. Framework preset: **Other**. Leave the build settings empty.
3. Open **Environment Variables** and add: name `GROQ_API_KEY`, value = your key.
4. Click **Deploy**. You get a URL like `https://your-project.vercel.app`. That is the link to submit.

If you add or change the environment variable after deploying, go to **Deployments → ⋯ → Redeploy**, otherwise the change doesn't take effect.

### 5. Check it like a stranger would
- Open the production URL (the short `.vercel.app` one, not a long preview link) in an incognito window: it must load without asking anyone to log in.
- Allow the microphone, ask all five sample questions out loud, and listen to the answers.
- Try it once on your phone.

## Editing later
Edit `persona.js` on GitHub (pencil icon) and commit. Vercel redeploys on its own in about a minute.

## Optional settings (environment variables)
| Name | What it does |
|---|---|
| `LLM_MODEL` | Use a specific model instead of the default (Groq: `llama-3.3-70b-versatile`, OpenAI: `gpt-4o-mini`, Gemini: `gemini-flash-latest`). If the default model is ever retired, the bot picks another one from the provider automatically. |
| `LLM_BASE_URL` + `LLM_API_KEY` | Point at any other OpenAI-compatible provider. |
| `STT_MODEL` | Speech-to-text model for the backup recorder. |

## If something's off
| What you see | Fix |
|---|---|
| "Setup isn't finished: no AI key is configured" | The environment variable is missing or misnamed, or you didn't redeploy after adding it. |
| "The site's AI key was rejected" | The key is wrong or revoked. Create a new one and update the variable. |
| The page loads but `/api/chat` is "not found" | The files were uploaded inside a subfolder. `api/` and `package.json` must be at the top level of the repo. |
| Answers are text only, no sound | The device is on silent, or "Voice off" is selected. On iPhone the ringer switch mutes web speech. |
| Mic does nothing | Microphone permission was denied; click the icon in the address bar to allow it. Typing always works. |
