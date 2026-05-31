import { useEffect, useState } from 'react';

// Hook for text-to-speech (German pronunciation)
function getVoices() {
  return window.speechSynthesis?.getVoices?.() || [];
}

function scoreVoice(voice, gender) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = lang.startsWith('de') ? 20 : 0;
  if (lang === 'de-de') score += 10;

  const femaleHints = ['female', 'frau', 'anna', 'helena', 'katja', 'marlene', 'petra', 'sandra', 'siri', 'google deutsch'];
  const maleHints = ['male', 'mann', 'markus', 'stefan', 'hans', 'klaus', 'yannick', 'florian', 'thomas'];
  const preferredHints = gender === 'male' ? maleHints : femaleHints;
  const avoidedHints = gender === 'male' ? femaleHints : maleHints;

  if (preferredHints.some(hint => name.includes(hint))) score += 8;
  if (avoidedHints.some(hint => name.includes(hint))) score -= 8;
  if (voice.localService) score += 1;
  return score;
}

function pickGermanVoice(gender = 'female') {
  const voices = getVoices();
  const germanVoices = voices.filter(voice => voice.lang?.toLowerCase().startsWith('de'));
  const candidates = germanVoices.length ? germanVoices : voices;
  return candidates
    .slice()
    .sort((a, b) => scoreVoice(b, gender) - scoreVoice(a, gender))[0] || null;
}

function pickDistinctGermanVoices() {
  const voices = getVoices();
  const germanVoices = voices.filter(voice => voice.lang?.toLowerCase().startsWith('de'));
  const candidates = germanVoices.length ? germanVoices : voices;
  const female = candidates
    .slice()
    .sort((a, b) => scoreVoice(b, 'female') - scoreVoice(a, 'female'))[0] || null;
  const male = candidates
    .filter(voice => voice.voiceURI !== female?.voiceURI)
    .slice()
    .sort((a, b) => scoreVoice(b, 'male') - scoreVoice(a, 'male'))[0] || pickGermanVoice('male');

  return {
    female: female?.voiceURI || '',
    male: male?.voiceURI || ''
  };
}

function pickVoiceByURI(voiceURI) {
  if (!voiceURI) return null;
  return getVoices().find(voice => voice.voiceURI === voiceURI) || null;
}

export function useSpeech() {
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => setVoices(getVoices());
    loadVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
  }, []);

  const speak = (text, rate = 0.72, options = {}) => {
    if (options.cancel !== false) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'de-DE';
    utterance.voice = pickVoiceByURI(options.voiceURI);
    utterance.rate = rate;
    if (options.pitch !== undefined) utterance.pitch = options.pitch;
    utterance.volume = options.volume ?? 1;
    utterance.onend = options.onend;
    utterance.onerror = options.onerror;
    window.speechSynthesis.speak(utterance);
    return utterance;
  };

  const stop = () => window.speechSynthesis.cancel();

  return {
    speak,
    stop,
    voices,
    germanVoices: voices.filter(voice => voice.lang?.toLowerCase().startsWith('de')),
    suggestedFemaleVoice: pickDistinctGermanVoices().female,
    suggestedMaleVoice: pickDistinctGermanVoices().male
  };
}

// Hook for speech recognition
import { useRef } from 'react';

export function useRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const startListening = (onResult, options = {}) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('La reconnaissance vocale n\'est pas supportée dans ce navigateur. Utilisez Chrome.');
      options.onError?.();
      return false;
    }

    const recognition = new SpeechRecognition();
    let heardResult = false;
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      heardResult = true;
      setTranscript(text);
      onResult?.(text);
    };

    recognition.onerror = (event) => {
      setError('Erreur microphone: ' + event.error);
      setIsListening(false);
      options.onError?.(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      options.onEnd?.(heardResult);
    };

    try {
      recognition.start();
      return true;
    } catch (err) {
      setError('Erreur microphone: ' + (err.message || 'démarrage impossible'));
      setIsListening(false);
      options.onError?.(err);
      return false;
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { isListening, transcript, error, startListening, stopListening };
}
