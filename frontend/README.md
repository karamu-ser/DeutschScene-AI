# DeutschScene AI Frontend

React/Vite frontend for DeutschScene AI, an immersive German learning app built around PDF lessons, AI-generated DeutschScenes, conversation practice, pronunciation, and adaptive review.

## Main Screens

- `Auth`: login, registration, and demo mode without backend credentials.
- `Dashboard`: learning overview, hard words, recent words, and quick actions.
- `Today`: daily guided path combining immersion, review, pronunciation, and conversation.
- `Upload`: PDF/image import with Gemini lesson extraction and partial-extraction warnings.
- `Lessons`: saved lessons plus the premium DeutschScene lesson enhancer.
- `Vocabulary`: searchable word table, memorization mode, audio, and printable PDF export.
- `Dialogue Film`: scene-based dialogue practice from PDF or AI-generated content.
- `Conversation`: level-aware German conversation with correction and useful words.
- `AI Lehrer`: PDF-based teacher questions, feedback, and practice sessions.
- `Smart Practice`, `Weakness Map`, `Exam`, `Story`, `Pronunciation`, `Quiz`, `Flashcards`, `Summary`, and `Basics`.

## Demo Mode

Click **Try Demo Without API Key** on the auth screen. Demo mode stores `demoMode=true` in local storage and uses mock data from `src/api/demoData.js`.

## Environment

Create `frontend/.env` when connecting to a backend:

```env
VITE_API_URL=http://localhost:3001/api
VITE_UPLOAD_TIMEOUT_MS=0
```

`VITE_UPLOAD_TIMEOUT_MS=0` disables the frontend upload timeout so long Gemini PDF analysis can finish.

## Development

```bash
npm install
npm run dev
```

The default Vite URL is:

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

Vite may warn when the generated bundle is larger than 500 kB. That warning is not blocking; code splitting can be added later if needed.

## Notes

- Keep `GEMINI_API_KEY` on the backend only.
- The vocabulary PDF export opens a printable Unicode-safe sheet. Users should choose **Save as PDF** in the browser print dialog.
- Speech recognition quality depends on browser support; Chrome/Edge are recommended.
