const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const GEMINI_TTS_MODELS = (process.env.GEMINI_TTS_MODELS || [
  process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
  'gemini-2.5-flash-preview-tts'
].join(','))
  .split(',')
  .map(model => model.trim())
  .filter(Boolean)
  .filter((model, index, models) => models.indexOf(model) === index);
const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const SAMPLE_WIDTH = 2;
const CACHE_DIR = path.join(__dirname, '../../cache/tts');

const VOICES = {
  lena: process.env.GEMINI_TTS_LENA_VOICE || 'Kore',
  samir: process.env.GEMINI_TTS_SAMIR_VOICE || 'Puck',
  default: process.env.GEMINI_TTS_DEFAULT_VOICE || 'Kore'
};

function getVoiceForSpeaker(speaker) {
  if (speaker === 'A') return VOICES.lena;
  if (speaker === 'B') return VOICES.samir;
  return VOICES.default;
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCachePath({ text, speaker, voice, speed }) {
  const key = JSON.stringify({
    provider: 'gemini-tts',
    text,
    speaker,
    voice,
    speed,
    sampleRate: SAMPLE_RATE
  });
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return path.join(CACHE_DIR, `${hash}.wav`);
}

function pcmToWav(pcm) {
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH, 28);
  header.writeUInt16LE(CHANNELS * SAMPLE_WIDTH, 32);
  header.writeUInt16LE(SAMPLE_WIDTH * 8, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function generateWithGemini({ model, text, speaker, voice }) {
  const speakingStyle = speaker === 'B'
    ? 'Read exactly this German sentence, every word, without adding, skipping, translating, or rephrasing. Use a natural young male student voice, warm tone, clear A1 pronunciation, slow pace: '
    : 'Read exactly this German sentence, every word, without adding, skipping, translating, or rephrasing. Use a natural young female student voice, warm tone, clear A1 pronunciation, slow pace: ';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${speakingStyle}"${text}"`
          }]
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        },
        model
      })
    }
  );

  if (!response.ok) {
    const details = await response.text();
    const err = new Error(`Gemini TTS ${model} failed with ${response.status}`);
    err.status = response.status;
    err.details = details.slice(0, 500);
    throw err;
  }

  const payload = await response.json();
  const audioBase64 = payload.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) {
    const err = new Error(`Gemini TTS ${model} n’a pas retourné d’audio.`);
    err.status = 502;
    throw err;
  }

  return pcmToWav(Buffer.from(audioBase64, 'base64'));
}

function shouldTryNextModel(err) {
  return !err.status || err.status >= 500 || err.status === 404;
}

router.post('/speak', async (req, res) => {
  const { text, speaker, speed = 0.75 } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text requis.' });
  if (!process.env.GEMINI_API_KEY) {
    return res.status(501).json({
      error: 'GEMINI_API_KEY manquant. Le site utilise la voix du navigateur.'
    });
  }

  try {
    const voice = getVoiceForSpeaker(speaker);
    ensureCacheDir();
    const cachePath = getCachePath({ text, speaker, voice, speed });
    if (fs.existsSync(cachePath)) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-TTS-Cache', 'hit');
      return res.send(fs.readFileSync(cachePath));
    }

    const errors = [];
    for (const model of GEMINI_TTS_MODELS) {
      try {
        const wavBuffer = await generateWithGemini({ model, text, speaker, voice });
        fs.writeFileSync(cachePath, wavBuffer);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-TTS-Cache', 'miss');
        res.setHeader('X-TTS-Model', model);
        return res.send(wavBuffer);
      } catch (err) {
        errors.push({ model, status: err.status || 500, details: err.details || err.message });
        if (!shouldTryNextModel(err)) break;
      }
    }

    const lastError = errors[errors.length - 1] || {};
    const quotaLimited = errors.some(error => error.status === 429);
    return res.status(lastError.status || 502).json({
      error: quotaLimited
        ? 'Quota Gemini TTS atteint. La voix du navigateur prend le relais.'
        : 'Erreur Gemini TTS.',
      models_tried: errors
    });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(502).json({ error: 'Erreur génération audio haute qualité.' });
  }
});

module.exports = router;
