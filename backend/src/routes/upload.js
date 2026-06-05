const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { analyzeLessonFile, analyzeLessonText, summarizeLessonsForReview, generateGermanBasics, generateDialogueFilmScene, matchLessonToExistingDirect } = require('../services/gemini');
const { query, run } = require('../services/db');

const router = express.Router();

function ensureReviewSchedule(wordId) {
  const existing = query('SELECT id FROM review_schedule WHERE word_id = ? LIMIT 1', [wordId]);
  if (!existing.length) run('INSERT INTO review_schedule (word_id) VALUES (?)', [wordId]);
}

function invalidateSummaryCache() {
  run('DELETE FROM summary_cache WHERE id = 1');
}

function parseJSON(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDefaultLessonTitle(title) {
  const normalized = normalizeText(title);
  return !normalized || normalized === 'lecon sans titre' || normalized === 'untitled lesson';
}

function uniqueNormalizedValues(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = normalizeText(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const MERGE_STOP_WORDS = new Set([
  'lecon', 'lesson', 'module', 'modul', 'grammatik', 'grammaire', 'exercice', 'exercices',
  'und', 'oder', 'avec', 'pour', 'dans', 'der', 'die', 'das', 'ein', 'eine', 'des', 'les',
  'satz', 'satze', 'niveau', 'level'
]);

function stemMergeToken(token) {
  let stem = token;
  for (const suffix of ['ungen', 'ungen', 'keit', 'heit', 'chen', 'ern', 'en', 'er', 'es', 'e', 'n', 's']) {
    if (stem.length > suffix.length + 3 && stem.endsWith(suffix)) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }
  return stem;
}

function mergeTokens(...values) {
  const tokens = new Set();
  for (const value of values) {
    const normalized = normalizeText(value);
    for (const rawToken of normalized.split(' ')) {
      const token = stemMergeToken(rawToken);
      if (token.length < 3 || MERGE_STOP_WORDS.has(token)) continue;
      tokens.add(token);
    }
  }
  return tokens;
}

function tokenOverlapScore(aTokens, bTokens) {
  let matches = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) matches += 1;
  }
  return matches;
}

function mergeObjectives(existingJson, newObjectives) {
  return uniqueNormalizedValues([
    ...parseJSON(existingJson, []),
    ...(newObjectives || [])
  ]);
}

function lessonMetadataLooksRelated(a, b) {
  const sameLevel = !a.level || !b.level || normalizeText(a.level) === normalizeText(b.level);
  if (!sameLevel) return false;

  const titleOverlap = tokenOverlapScore(mergeTokens(a.title), mergeTokens(b.title));
  if (titleOverlap >= 2) return true;

  const topicOverlap = tokenOverlapScore(
    mergeTokens(a.title, a.topic, a.unit, ...(a.objectives || [])),
    mergeTokens(b.title, b.topic, b.unit, ...(b.objectives || []))
  );
  return topicOverlap >= 3;
}

function getExistingLessonMergeProfile(lessonId) {
  const words = query('SELECT word, topic FROM words WHERE lesson_id = ?', [lessonId]);
  const grammar = query('SELECT rule_title FROM grammar_rules WHERE lesson_id = ?', [lessonId]);
  const expressions = query('SELECT expression, context FROM expressions WHERE lesson_id = ?', [lessonId]);
  return {
    words: words.flatMap(item => [item.word, item.topic]),
    grammar: grammar.map(item => item.rule_title),
    expressions: expressions.flatMap(item => [item.expression, item.context])
  };
}

function incomingLessonMergeProfile(lesson) {
  return {
    words: (lesson.vocabulary || []).flatMap(item => [item.word, item.topic]),
    grammar: (lesson.grammar || []).map(item => item.rule_title),
    expressions: (lesson.expressions || []).flatMap(item => [item.expression, item.context])
  };
}

function lessonContentLooksRelated(existingLesson, incomingLesson) {
  const profile = getExistingLessonMergeProfile(existingLesson.id);
  const incomingProfile = incomingLessonMergeProfile(incomingLesson);
  const existingTokens = mergeTokens(
    existingLesson.title,
    existingLesson.topic,
    existingLesson.unit,
    ...parseJSON(existingLesson.objectives_json, []),
    ...profile.words,
    ...profile.grammar,
    ...profile.expressions
  );
  const incomingTokens = mergeTokens(
    incomingLesson.lesson?.title,
    incomingLesson.lesson?.topic,
    incomingLesson.lesson?.unit,
    ...(incomingLesson.lesson?.objectives || []),
    ...incomingProfile.words,
    ...incomingProfile.grammar,
    ...incomingProfile.expressions
  );

  const overlap = tokenOverlapScore(existingTokens, incomingTokens);
  const smallerSize = Math.min(existingTokens.size, incomingTokens.size);
  return overlap >= 4 || (overlap >= 3 && smallerSize > 0 && overlap / smallerSize >= 0.35);
}

function lessonMergeIdentity(lesson) {
  const title = normalizeText(lesson.title);
  if (title && !isDefaultLessonTitle(title)) return `title:${title}`;

  const unit = normalizeText(lesson.unit);
  const topic = normalizeText(lesson.topic);
  const level = normalizeText(lesson.level);
  if (unit || topic) return `unit:${unit}|topic:${topic}|level:${level}`;
  return null;
}

function lessonHasContent(lesson) {
  return Boolean(
    (lesson?.vocabulary || []).length ||
    (lesson?.grammar || []).length ||
    (lesson?.dialogues || []).length ||
    (lesson?.expressions || []).length ||
    (lesson?.exercises || []).length
  );
}

function lessonContentCount(lesson) {
  return (lesson?.vocabulary || []).length +
    (lesson?.grammar || []).length +
    (lesson?.dialogues || []).length +
    (lesson?.expressions || []).length +
    (lesson?.exercises || []).length;
}

function lessonLooksTooThinForSource(lesson, { textLength = 0, fileSize = 0 } = {}) {
  const baseCount = lessonContentCount(lesson);
  const wordCount = (lesson?.vocabulary || []).length;
  const grammarTables = (lesson?.grammar || []).reduce((total, rule) => total + (rule.table || []).length, 0);
  const exerciseQuestions = (lesson?.exercises || []).reduce((total, exercise) => total + (exercise.questions || []).length, 0);
  const richContentCount = baseCount + grammarTables + exerciseQuestions;

  if (textLength >= 3000 && wordCount < 25) return true;
  if (textLength >= 1200 && richContentCount < 8) return true;
  if (textLength >= 4000 && richContentCount < 14) return true;
  if (fileSize >= 1024 * 1024 && richContentCount < 10) return true;
  return false;
}

const TEXT_FALLBACK_STOP_WORDS = new Set([
  'smartdeutsch', 'center', 'sprachschule', 'lehr', 'lernmaterialien', 'lehrmaterial',
  'niveau', 'anfanger', 'inhalt', 'dieser', 'lektion', 'teil', 'seite', 'beispiele',
  'bsp', 'regel', 'regeln', 'merkhilfe', 'hinweis', 'zusammenfassung', 'deutsche',
  'deutschen', 'alphabet', 'buchstaben', 'aussprache', 'wird', 'werden', 'wenn',
  'nach', 'vor', 'bei', 'und', 'oder', 'mit', 'wie', 'ist', 'das', 'der', 'die',
  'ein', 'eine', 'einen', 'im', 'am', 'auf', 'aus', 'man', 'nicht', 'immer',
  'meistens', 'langes', 'kurzem', 'vokal', 'vokale', 'wort', 'wortende'
]);

const TEXT_FALLBACK_TRANSLATIONS = {
  'die Straße': ['la rue', 'الشارع'],
  'der Spaß': ["l'amusement / le plaisir", 'المتعة'],
  'das Wasser': ["l'eau", 'الماء'],
  'der Lehrer': ['le professeur', 'الأستاذ'],
  'der Bruder': ['le frère', 'الأخ'],
  'die Station': ['la station', 'المحطة'],
  'die Zeitung': ['le journal', 'الجريدة'],
  'die Versicherung': ["l'assurance", 'التأمين'],
  'die Schule': ["l'école", 'المدرسة'],
  'der Tisch': ['la table', 'الطاولة'],
  'das Haus': ['la maison', 'المنزل'],
  'der Baum': ["l'arbre", 'الشجرة'],
  'die Familie': ['la famille', 'العائلة'],
  'der Sport': ['le sport', 'الرياضة'],
  'sehen': ['voir', 'يرى'],
  'gehen': ['aller', 'يذهب'],
  'verstehen': ['comprendre', 'يفهم'],
  'schreiben': ['écrire', 'يكتب'],
  'spielen': ['jouer', 'يلعب']
};

const PEDAGOGICAL_SOUND_ITEMS = new Set([
  'ä', 'ö', 'ü', 'ß', 'au', 'ei', 'eu', 'äu', 'ie', 'sch', 'ch', 'chs', 'qu', 'st', 'sp', '-er', '-tion', '-ung'
]);

const GRAMMAR_TECHNICAL_TERMS = new Set([
  'verb', 'verben', 'endung', 'endungen', 'subjekt', 'prädikat', 'pradikat', 'objekt',
  'präsens', 'prasens', 'infinitiv', 'konjugation', 'nominativ', 'akkusativ', 'dativ',
  'genitiv', 'artikel', 'frage', 'fragen', 'w fragen', 'ja nein fragen', 'vokal',
  'vokale', 'konsonant', 'konsonanten', 'diphthong', 'umlaut', 'umlaute'
]);

const W_QUESTION_WORDS = new Set(['wer', 'was', 'wann', 'wo', 'woher', 'wohin', 'wie', 'warum', 'wieso', 'weshalb']);
const GREETING_EXPRESSIONS = new Set([
  'hallo', 'guten morgen', 'guten tag', 'guten abend', 'gute nacht',
  'auf wiedersehen', 'tschüss', 'tschuss', 'bis bald', 'bis später', 'bis spater'
]);
const CONJUGATED_VERB_FORMS = new Set([
  'heißt', 'heisst', 'heiße', 'heisse', 'grüße', 'grusse', 'grüßt', 'grusst',
  'hängt', 'hangt', 'kommst', 'komme', 'kommt', 'wohnst', 'wohne', 'wohnt',
  'machst', 'mache', 'macht', 'arbeitest', 'arbeitet', 'lernst', 'lerne', 'lernt',
  'bist', 'bin', 'ist', 'sind', 'seid', 'habe', 'hast', 'hat', 'haben', 'habt'
]);
const KNOWN_PROPER_NOUNS = new Set([
  'berlin', 'müller', 'muller', 'türkei', 'turkei', 'deutschland', 'italien',
  'spanien', 'brasilien', 'syrien', 'jordanien', 'paul', 'meier', 'meyer',
  'maier', 'mayer'
]);

const EXPRESSION_TRANSLATIONS = {
  'hallo': ['salut / bonjour', 'مرحبا'],
  'guten morgen': ['bonjour le matin', 'صباح الخير'],
  'guten tag': ['bonjour', 'نهارك سعيد'],
  'guten abend': ['bonsoir', 'مساء الخير'],
  'gute nacht': ['bonne nuit', 'تصبح على خير'],
  'auf wiedersehen': ['au revoir', 'إلى اللقاء'],
  'tschüss': ['salut / au revoir', 'مع السلامة'],
  'tschuss': ['salut / au revoir', 'مع السلامة'],
  'bis bald': ['à bientôt', 'إلى اللقاء قريبا']
};

function stripPdfNoise(text) {
  return String(text || '')
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/\b[A-Z]{2,}\b/g, match => match.length <= 3 ? match : ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findExampleForTerm(text, term) {
  const escaped = String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sentence = String(text || '')
    .split(/[\n.!?]+/)
    .map(item => item.trim())
    .find(item => new RegExp(`\\b${escaped}\\b`, 'i').test(item) && item.length <= 120);
  return sentence || null;
}

function splitObviousArticleSuffix(value) {
  const raw = String(value || '').trim();
  if (/\s/.test(raw)) return raw;
  const match = raw.match(/^(.{4,})(der|die|das)$/i);
  if (!match) return raw;

  const base = match[1];
  const article = match[2].toLowerCase();
  if (!/^[A-ZÄÖÜ]/.test(base)) return raw;
  return `${article} ${base}`;
}

function looksLikeGluedOcrToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (/\s/.test(raw)) return false;
  if (raw.length > 28) return true;
  if (/^.{4,}(der|die|das)$/i.test(raw)) return true;
  if (/[a-zäöüß][A-ZÄÖÜ]/.test(raw)) return true;
  if (/(der|die|das)[A-ZÄÖÜ]/.test(raw.slice(4))) return true;
  return false;
}

function cleanVocabularyWord(value) {
  const obvious = splitObviousArticleSuffix(value);
  return looksLikeGluedOcrToken(obvious) ? null : obvious;
}

function isGrammarTechnicalTerm(word) {
  return GRAMMAR_TECHNICAL_TERMS.has(normalizeText(word));
}

function isWQuestionWord(word) {
  return W_QUESTION_WORDS.has(normalizeText(word));
}

function isGreetingExpression(word) {
  return GREETING_EXPRESSIONS.has(normalizeText(word));
}

function isConjugatedVerbForm(word) {
  return CONJUGATED_VERB_FORMS.has(normalizeText(word));
}

function isKnownProperNoun(word) {
  const normalized = normalizeText(word);
  return KNOWN_PROPER_NOUNS.has(normalized) || /^[A-ZÄÖÜ][a-zäöüß]+$/.test(String(word || '').trim()) && !hasArticlePrefix(word);
}

function hasArticlePrefix(word) {
  const first = String(word || '').trim().split(/\s+/)[0]?.toLowerCase();
  return ['der', 'die', 'das'].includes(first);
}

function hasUsefulTranslation(item) {
  return Boolean(String(item?.translation_fr || '').trim() || String(item?.translation_ar || '').trim());
}

function hasUsefulExample(item) {
  const example = String(item?.example_de || '').trim();
  return example && example !== item.word && example.length <= 160;
}

function isMeaningfulVocabularyItem(item) {
  const word = String(item?.word || '').trim();
  if (!word) return false;
  const key = normalizeText(word);
  if (!key || TEXT_FALLBACK_STOP_WORDS.has(key)) return false;
  if (PEDAGOGICAL_SOUND_ITEMS.has(word.toLowerCase())) return false;
  if (isGrammarTechnicalTerm(word) || isWQuestionWord(word) || isGreetingExpression(word)) return false;
  if (isConjugatedVerbForm(word) || isKnownProperNoun(word)) return false;
  if (hasUsefulTranslation(item)) return true;
  if (['der', 'die', 'das'].includes(item?.article) && word.split(/\s+/).length >= 2) return true;
  if ((item?.type || '').toLowerCase() === 'verb' && /en$/i.test(word)) return true;
  if (hasUsefulExample(item) && /[A-ZÄÖÜäöüß]/.test(word) && word.length >= 3) return true;
  return false;
}

function createFallbackWord(word, text, level, topic, type = 'other') {
  const safeWord = cleanVocabularyWord(word);
  if (!safeWord) return null;
  const parts = safeWord.split(/\s+/);
  const article = ['der', 'die', 'das'].includes(parts[0]?.toLowerCase()) ? parts[0].toLowerCase() : null;
  const normalizedWord = article ? `${article} ${parts.slice(1).join(' ')}` : safeWord;
  const [translationFr, translationAr] = TEXT_FALLBACK_TRANSLATIONS[normalizedWord] || [null, null];
  return {
    word: normalizedWord,
    article,
    plural: null,
    type,
    translation_fr: translationFr,
    translation_ar: translationAr,
    example_de: findExampleForTerm(text, parts[parts.length - 1] || normalizedWord),
    example_fr: null,
    level,
    topic
  };
}

function buildVocabularyFromText(text, level, topic) {
  const cleanText = stripPdfNoise(text);
  const items = [];
  const add = (word, type = 'other') => {
    const safeWord = cleanVocabularyWord(word);
    if (!safeWord) return;
    const key = normalizeText(safeWord);
    if (!key || items.some(item => normalizeText(item.word) === key)) return;
    const item = createFallbackWord(safeWord, cleanText, level, topic, type);
    if (item && isMeaningfulVocabularyItem(item)) items.push(item);
  };

  for (const match of cleanText.matchAll(/\b(der|die|das)\s+[A-ZÄÖÜ][\p{L}ÄÖÜäöüß-]+/gu)) {
    add(match[0], 'noun');
  }

  for (const match of cleanText.matchAll(/[„"]([^„”"]{4,120})[”"]/g)) {
    const phrase = match[1].trim();
    if (/[a-zäöüß]/i.test(phrase)) add(phrase, 'phrase');
  }

  for (const match of cleanText.matchAll(/\b[\p{L}ÄÖÜäöüß]{4,}\b/gu)) {
    const word = match[0];
    const key = normalizeText(word);
    if (TEXT_FALLBACK_STOP_WORDS.has(key) || /^\d+$/.test(key)) continue;
    if (/^[A-ZÄÖÜ]/.test(word) || /[äöüß]/.test(word)) {
      add(word, /^[A-ZÄÖÜ]/.test(word) ? 'noun' : 'other');
    }
    if (items.length >= 200) break;
  }

  return items.slice(0, 200);
}

function buildGrammarFromText(text) {
  const cleanText = stripPdfNoise(text);
  const rules = [];
  const addRule = (rule_title, explanation_fr, examples = [], table = []) => {
    if (rules.some(rule => normalizeText(rule.rule_title) === normalizeText(rule_title))) return;
    rules.push({
      rule_title,
      explanation_fr,
      explanation_ar: 'شرح مبسط مستخرج من محتوى الملف.',
      examples,
      table
    });
  };

  if (/Umlaute|Ä|Ö|Ü|ß/.test(cleanText)) {
    addRule('Umlaute et scharfes S',
      'Les Umlaute Ä, Ö, Ü changent le son de la voyelle. Le ß apparaît après une voyelle longue ou une diphtongue.',
      [{ de: 'die Straße', fr: 'la rue' }, { de: 'der Spaß', fr: 'le plaisir' }, { de: 'das Wasser', fr: "l'eau" }],
      [{ header: ['Signe', 'Règle', 'Exemples'], rows: [['Ä/ä', 'son entre a et e', 'spät, Männer'], ['Ö/ö', 'o plus fermé', 'Öl, Größe'], ['Ü/ü', 'u avec la langue vers l avant', 'grün, Gemüse'], ['ß', 'après voyelle longue', 'Straße, Spaß']] }]
    );
  }
  if (/Vokalverbindungen|au|ei|eu|ie/.test(cleanText)) {
    addRule('Vokalverbindungen',
      'Les combinaisons au, ei, eu/äu et ie ont une prononciation stable en allemand.',
      [{ de: 'Paul kauft einen Baum.', fr: 'Paul achète un arbre.' }, { de: 'Die Familie kommt aus Italien.', fr: "La famille vient d'Italie." }],
      [{ header: ['Combinaison', 'Son', 'Exemples'], rows: [['au', 'ow', 'Haus, Baum'], ['ei', 'eye', 'kein, Schwein'], ['eu/äu', 'oy', 'Deutsch, Häuser'], ['ie', 'i long', 'sieben, fliegen']] }]
    );
  }
  if (/Konsonantenkombinationen|sch|chs|qu/.test(cleanText)) {
    addRule('Konsonantenkombinationen',
      'Les groupes sch, ch, chs et qu ont des sons spécifiques. ch change selon la voyelle précédente.',
      [{ de: 'Ich schreibe in der Schule.', fr: "J'écris à l'école." }, { de: 'Der Kuchen ist hoch.', fr: 'Le gâteau est haut.' }],
      [{ header: ['Groupe', 'Prononciation', 'Exemples'], rows: [['sch', 'sh', 'Schule, Tisch'], ['ch', 'avant ou arrière', 'ich, Bach'], ['chs', 'ks', 'sechs'], ['qu', 'kv', 'Quark']] }]
    );
  }
  if (/\bst\b|\bsp\b/.test(cleanText)) {
    addRule('st et sp au début du mot',
      'Au début du mot, st se prononce scht et sp se prononce schp.',
      [{ de: 'Ich spiele Sport.', fr: 'Je fais du sport.' }, { de: 'Ich verstehe die Stimme.', fr: 'Je comprends la voix.' }]
    );
  }
  if (/-er|Dehnungs-h|HIAT-H|Das R/.test(cleanText)) {
    addRule('-er, h muet et R allemand',
      'En fin de mot, -er devient très faible. Le h peut allonger une voyelle sans être prononcé. Le R allemand peut être produit dans la gorge.',
      [{ de: 'Der Lehrer ist mein Bruder.', fr: 'Le professeur est mon frère.' }, { de: 'Ich gehe und sehe.', fr: 'Je vais et je vois.' }]
    );
  }
  if (/Das S|weiches S|hartes S/.test(cleanText)) {
    addRule('Das S',
      'Le S est doux devant une voyelle et dur à la fin du mot ou devant une consonne.',
      [{ de: 'Sie sehen sieben Sommer-Reisen.', fr: "Ils voient sept voyages d'été." }, { de: 'Der Preis ist aus.', fr: 'Le prix est fini.' }]
    );
  }
  if (/-tion|-ung/.test(cleanText)) {
    addRule('Endungen -tion und -ung',
      '-tion se prononce tzion. Dans -ung, le g final est très faible et forme un son nasal.',
      [{ de: 'die Station', fr: 'la station' }, { de: 'die Zeitung', fr: 'le journal' }, { de: 'die Versicherung', fr: "l'assurance" }]
    );
  }

  return rules;
}

function enrichLessonFromExtractedText(lesson, extractedText) {
  if (!extractedText || extractedText.length < Number(process.env.PDF_TEXT_MIN_CHARS || 200)) return lesson;
  const level = lesson?.lesson?.level || 'A1';
  const topic = lesson?.lesson?.topic || 'Contenu extrait du PDF';
  const fallbackVocabulary = buildVocabularyFromText(extractedText, level, topic);
  const fallbackGrammar = buildGrammarFromText(extractedText);

  return {
    ...lesson,
    lesson: {
      title: lesson?.lesson?.title || 'Leçon extraite du PDF',
      level,
      unit: lesson?.lesson?.unit || null,
      topic,
      objectives: uniqueNormalizedValues([
        ...(lesson?.lesson?.objectives || []),
        'Extraire les mots importants du PDF',
        'Comprendre les règles principales de la leçon',
        'Pratiquer avec des exemples du document'
      ])
    },
    vocabulary: uniqueBy([...(lesson?.vocabulary || []), ...fallbackVocabulary], item => normalizeText(item.word)),
    grammar: uniqueBy([...(lesson?.grammar || []), ...fallbackGrammar], item => normalizeText(item.rule_title)),
    dialogues: lesson?.dialogues || [],
    expressions: lesson?.expressions || [],
    exercises: lesson?.exercises || []
  };
}

function cleanLessonVocabulary(lesson) {
  const vocabulary = [];
  const expressions = [...(lesson?.expressions || [])];
  const expressionKeys = new Set(expressions.map(item => normalizeText(item.expression)));
  const seen = new Set();
  for (const item of (lesson?.vocabulary || [])) {
    const safeWord = cleanVocabularyWord(item.word);
    if (!safeWord) continue;
    const key = normalizeText(safeWord);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (isGreetingExpression(safeWord) || (item?.type || '').toLowerCase() === 'phrase') {
      if (!expressionKeys.has(key)) {
        const [translationFr, translationAr] = EXPRESSION_TRANSLATIONS[key] || [item.translation_fr || null, item.translation_ar || null];
        expressions.push({
          expression: safeWord,
          translation_fr: translationFr,
          translation_ar: translationAr,
          context: item.topic || lesson?.lesson?.topic || 'expression utile'
        });
        expressionKeys.add(key);
      }
      continue;
    }

    const parts = safeWord.split(/\s+/);
    const article = ['der', 'die', 'das'].includes(parts[0]?.toLowerCase()) ? parts[0].toLowerCase() : item.article || null;
    const cleanedItem = {
      ...item,
      word: safeWord,
      article
    };
    if (!isMeaningfulVocabularyItem(cleanedItem)) continue;
    vocabulary.push(cleanedItem);
  }

  return {
    ...lesson,
    vocabulary,
    expressions
  };
}

function isEmptyDocumentAnalysis(lesson) {
  const title = normalizeText(lesson?.lesson?.title);
  const topic = normalizeText(lesson?.lesson?.topic);
  const emptyTitle = title.includes('document est vide') ||
    title.includes('document vide') ||
    title.includes('empty document');
  const emptyTopic = topic === 'n a' || topic === 'na' || topic === 'none';
  return emptyTitle || (!lessonHasContent(lesson) && emptyTopic);
}

function findMatchingLesson(userId, lessonMeta, analyzedLesson = null) {
  const lessons = query(
    'SELECT * FROM lessons WHERE user_id = ? ORDER BY created_at ASC, id ASC',
    [userId]
  );
  const incomingTitle = normalizeText(lessonMeta.title);
  const incomingUnit = normalizeText(lessonMeta.unit);
  const incomingTopic = normalizeText(lessonMeta.topic);
  const incomingLevel = normalizeText(lessonMeta.level);

  return lessons.find(existing => {
    const sameTitle = incomingTitle
      && !isDefaultLessonTitle(incomingTitle)
      && normalizeText(existing.title) === incomingTitle;
    const sameUnitTopic = (incomingUnit || incomingTopic)
      && normalizeText(existing.unit) === incomingUnit
      && normalizeText(existing.topic) === incomingTopic
      && normalizeText(existing.level) === incomingLevel;
    return sameTitle || sameUnitTopic;
  }) || null;
}

function getOrCreateLesson(userId, lessonMeta, analyzedLesson) {
  const existing = findMatchingLesson(userId, lessonMeta, analyzedLesson);
  if (existing) {
    const objectives = mergeObjectives(existing.objectives_json, lessonMeta.objectives);
    const title = isDefaultLessonTitle(existing.title) && !isDefaultLessonTitle(lessonMeta.title)
      ? lessonMeta.title
      : existing.title;

    run(
      `UPDATE lessons
       SET title = ?, level = ?, unit = ?, topic = ?, objectives_json = ?
       WHERE id = ? AND user_id = ?`,
      [
        title || lessonMeta.title,
        existing.level || lessonMeta.level || 'A1',
        existing.unit || lessonMeta.unit || null,
        existing.topic || lessonMeta.topic || null,
        JSON.stringify(objectives),
        existing.id,
        userId
      ]
    );
    return { lessonId: Number(existing.id), merged: true };
  }

  const lessonRow = run(
    `INSERT INTO lessons (user_id, title, level, unit, topic, objectives_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      lessonMeta.title || 'Leçon sans titre',
      lessonMeta.level || 'A1',
      lessonMeta.unit || null,
      lessonMeta.topic || null,
      JSON.stringify(lessonMeta.objectives || [])
    ]
  );

  let lessonId = Number(lessonRow?.lastInsertRowid || lessonRow?.lastID || lessonRow?.id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    const dbRes = query('SELECT last_insert_rowid() as id');
    lessonId = Number(dbRes[0].id);
  }
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    throw new Error("Impossible de récupérer l'ID de la leçon créée.");
  }
  return { lessonId, merged: false };
}

function createLesson(userId, lessonMeta) {
  run(
    `INSERT INTO lessons (user_id, title, level, unit, topic, objectives_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      lessonMeta.title || 'Leçon sans titre',
      lessonMeta.level || 'A1',
      lessonMeta.unit || null,
      lessonMeta.topic || null,
      JSON.stringify(lessonMeta.objectives || [])
    ]
  );

  const [created] = query(
    `SELECT id FROM lessons
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );
  const lessonId = Number(created?.id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    throw new Error("Impossible de récupérer l'ID de la leçon créée.");
  }
  return { lessonId, merged: false };
}

function dedupeLessonContent(lessonId, userId) {
  const seenWords = new Set();
  for (const word of query('SELECT id, word FROM words WHERE lesson_id = ? AND user_id = ? ORDER BY id ASC', [lessonId, userId])) {
    const key = normalizeText(word.word);
    if (!key || !seenWords.has(key)) {
      if (key) seenWords.add(key);
      continue;
    }
    run('DELETE FROM review_schedule WHERE word_id = ?', [word.id]);
    run('DELETE FROM words WHERE id = ? AND user_id = ?', [word.id, userId]);
  }

  const dedupeTable = (table, keyFn) => {
    const seen = new Set();
    for (const row of query(`SELECT * FROM ${table} WHERE lesson_id = ? ORDER BY id ASC`, [lessonId])) {
      const key = keyFn(row);
      if (!key || !seen.has(key)) {
        if (key) seen.add(key);
        continue;
      }
      run(`DELETE FROM ${table} WHERE id = ?`, [row.id]);
    }
  };

  dedupeTable('grammar_rules', row => normalizeText(row.rule_title));
  dedupeTable('dialogues', row => normalizeText(row.title) || normalizeText(row.lines_json));
  dedupeTable('expressions', row => normalizeText(row.expression));
  dedupeTable('exercises', row => [
    normalizeText(row.type),
    normalizeText(row.instruction_de),
    normalizeText(row.instruction_fr)
  ].join('|'));
}

function mergeLessonContent(targetId, sourceId, userId) {
  const [target] = query('SELECT * FROM lessons WHERE id = ? AND user_id = ?', [targetId, userId]);
  const [source] = query('SELECT * FROM lessons WHERE id = ? AND user_id = ?', [sourceId, userId]);
  if (!target || !source || targetId === sourceId) return;

  const objectives = mergeObjectives(target.objectives_json, parseJSON(source.objectives_json, []));
  run(
    `UPDATE lessons
     SET title = ?, level = ?, unit = ?, topic = ?, objectives_json = ?
     WHERE id = ? AND user_id = ?`,
    [
      isDefaultLessonTitle(target.title) && !isDefaultLessonTitle(source.title) ? source.title : target.title,
      target.level || source.level || 'A1',
      target.unit || source.unit || null,
      target.topic || source.topic || null,
      JSON.stringify(objectives),
      targetId,
      userId
    ]
  );

  run('UPDATE words SET lesson_id = ? WHERE lesson_id = ? AND user_id = ?', [targetId, sourceId, userId]);
  for (const table of ['grammar_rules', 'dialogues', 'expressions', 'exercises']) {
    run(`UPDATE ${table} SET lesson_id = ? WHERE lesson_id = ?`, [targetId, sourceId]);
  }
  run('DELETE FROM lessons WHERE id = ? AND user_id = ?', [sourceId, userId]);
  dedupeLessonContent(targetId, userId);
}

function mergeDuplicateLessonsForUser(userId) {
  const lessons = query(
    'SELECT * FROM lessons WHERE user_id = ? ORDER BY created_at ASC, id ASC',
    [userId]
  );
  const lessonByIdentity = new Map();

  for (const lesson of lessons) {
    const identity = lessonMergeIdentity(lesson);
    if (!identity) continue;
    if (!lessonByIdentity.has(identity)) {
      lessonByIdentity.set(identity, Number(lesson.id));
      continue;
    }
    mergeLessonContent(lessonByIdentity.get(identity), Number(lesson.id), userId);
  }
}

function getFullLessons(userId) {
  mergeDuplicateLessonsForUser(userId);
  const lessons = query(`
    SELECT l.*,
      (SELECT COUNT(*) FROM words w WHERE w.lesson_id = l.id) as word_count,
      (SELECT COUNT(*) FROM grammar_rules g WHERE g.lesson_id = l.id) as grammar_count,
      (SELECT COUNT(*) FROM dialogues d WHERE d.lesson_id = l.id) as dialogue_count,
      (SELECT COUNT(*) FROM expressions e WHERE e.lesson_id = l.id) as expression_count,
      (SELECT COUNT(*) FROM exercises ex WHERE ex.lesson_id = l.id) as exercise_count
    FROM lessons l
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC
  `, [userId]);

  return lessons.map(lesson => {
    const lessonId = Number(lesson.id);
    const words = query('SELECT * FROM words WHERE lesson_id = ? AND user_id = ?', [lessonId, userId]);
    const grammar = query('SELECT * FROM grammar_rules WHERE lesson_id = ?', [lessonId]);
    const dialogues = query('SELECT * FROM dialogues WHERE lesson_id = ?', [lessonId]);
    const expressions = query('SELECT * FROM expressions WHERE lesson_id = ?', [lessonId]);
    const exercises = query('SELECT * FROM exercises WHERE lesson_id = ?', [lessonId]);

    return {
      lesson: { ...lesson, objectives: parseJSON(lesson.objectives_json, []) },
      vocabulary: words,
      grammar: grammar.map(g => ({
        ...g,
        examples: parseJSON(g.examples_json, []),
        table: parseJSON(g.table_json, [])
      })),
      dialogues: dialogues.map(d => ({
        ...d,
        lines: parseJSON(d.lines_json, [])
      })),
      expressions,
      exercises: exercises.map(e => ({
        ...e,
        questions: parseJSON(e.questions_json, [])
      }))
    };
  });
}

function getLessonSignature(lessons) {
  return `summary-v3-child-complete|${lessons
    .map(item => {
      const lesson = item.lesson || {};
      return [
        lesson.id,
        normalizeText(lesson.title),
        normalizeText(lesson.topic),
        item.vocabulary.length,
        item.grammar.length,
        item.dialogues.length,
        item.expressions.length,
        item.exercises.length,
        item.grammar.map(g => normalizeText(g.rule_title)).join(',')
      ].join(':');
    })
    .join('|')}`;
}

function getDialogueFilmSignature(lessons) {
  return `dialogue-film-v4-cover-notions|${lessons
    .map(item => {
      const lesson = item.lesson || {};
      return [
        lesson.id,
        normalizeText(lesson.title),
        item.dialogues.length,
        item.grammar.length,
        item.expressions.length,
        item.exercises.length,
        item.vocabulary.length,
        item.grammar.map(g => normalizeText(g.rule_title)).join(','),
        item.vocabulary.slice(0, 20).map(w => normalizeText(w.word)).join(',')
      ].join(':');
    })
    .join('|')}`;
}

function getCachedSummary(signature) {
  const [cached] = query(
    'SELECT summary_json, lesson_signature, generated_by, updated_at FROM summary_cache WHERE id = 1'
  );
  if (!cached || cached.lesson_signature !== signature) return null;

  const summary = parseJSON(cached.summary_json, null);
  if (!summary) return null;
  return {
    ...summary,
    generated_by: cached.generated_by || summary.generated_by || 'ai',
    cached: true,
    cached_at: cached.updated_at
  };
}

function saveSummaryCache(summary, signature) {
  run(
    `INSERT OR REPLACE INTO summary_cache
       (id, summary_json, lesson_signature, generated_by, updated_at)
     VALUES (1, ?, ?, ?, datetime('now'))`,
    [JSON.stringify(summary), signature, summary.generated_by || 'ai']
  );
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackSubrules(grammarRule) {
  const haystack = normalizeText([
    grammarRule.rule_title,
    grammarRule.explanation_fr,
    ...(grammarRule.examples || []).flatMap(ex => [ex.de, ex.fr])
  ].join(' '));
  if (!haystack.includes('frage') && !haystack.includes('w frag')) return [];

  const questionWords = [
    ['wer', 'qui', 'pour demander une personne', 'Wer bist du?', 'Qui es-tu ?', 'Wer ist das?', 'Qui est-ce ?'],
    ['was', 'quoi / que', 'pour demander une chose', 'Was ist das?', 'Qu’est-ce que c’est ?', 'Was machst du?', 'Que fais-tu ?'],
    ['wo', 'où', 'pour demander un lieu', 'Wo wohnst du?', 'Où habites-tu ?', 'Wo ist die Schule?', 'Où est l’école ?'],
    ['woher', 'd’où', 'pour demander l’origine', 'Woher kommst du?', 'D’où viens-tu ?', 'Woher kommt er?', 'D’où vient-il ?'],
    ['wie', 'comment', 'pour demander la manière, le nom ou l’état', 'Wie heißt du?', 'Comment tu t’appelles ?', 'Wie geht es dir?', 'Comment ça va ?'],
    ['wann', 'quand', 'pour demander le temps', 'Wann kommst du?', 'Quand viens-tu ?', 'Wann beginnt der Kurs?', 'Quand commence le cours ?']
  ];

  return questionWords.map(([name, meaning, when_to_use, de1, fr1, de2, fr2]) => ({
    name,
    meaning,
    when_to_use,
    examples: [
      { de: de1, fr: fr1 },
      { de: de2, fr: fr2 }
    ]
  }));
}

function fallbackSummary(lessons) {
  const vocabulary = uniqueBy(lessons.flatMap(item => item.vocabulary.map(w => ({
    de: w.word,
    fr: w.translation_fr,
    ar: w.translation_ar,
    memory: w.article ? `Article : ${w.article}` : (w.type || ''),
    example_de: w.example_de,
    example_fr: w.example_fr,
    group: w.topic || 'autre'
  }))), w => String(w.de || '').toLowerCase());

  const grammar = uniqueBy(lessons.flatMap(item => item.grammar.map(g => ({
    title: g.rule_title,
    simple: g.explanation_fr,
    pattern: g.table?.[0]?.header?.join(' / ') || '',
    child_explanation: g.explanation_fr ? `Version très facile : ${g.explanation_fr}` : '',
    steps: [
      'Regarde la phrase allemande.',
      'Trouve le petit mot ou la forme qui change.',
      'Répète avec deux exemples simples.'
    ],
    subrules: buildFallbackSubrules(g),
    examples: (g.examples || []).map(ex => ({ de: ex.de, fr: ex.fr }))
  }))), g => String(g.title || '').toLowerCase());

  const phrases = uniqueBy(lessons.flatMap(item => [
    ...item.expressions.map(e => ({
      de: e.expression,
      fr: e.translation_fr,
      ar: e.translation_ar,
      use: e.context
    })),
    ...item.dialogues.flatMap(d => (d.lines || []).map(line => ({
      de: line.text,
      fr: line.translation_fr,
      ar: line.translation_ar,
      use: d.title
    })))
  ]), p => String(p.de || '').toLowerCase());

  return {
    title: 'Résumé intelligent A1/A2',
    generated_by: 'fallback',
    source_coverage: lessons.map(item => ({
      lesson_title: item.lesson?.title || 'Leçon sans titre',
      covered_in: [
        item.vocabulary.length ? 'Vocabulaire essentiel' : null,
        item.grammar.length ? 'Grammaire claire' : null,
        item.dialogues.length ? 'Dialogues modèles' : null,
        item.exercises.length ? 'Mini test' : null
      ].filter(Boolean).join(', ') || 'Vue générale'
    })),
    overview: lessons.length
      ? 'Cette fiche rassemble toutes les notions importantes de tes leçons dans un seul parcours de révision.'
      : '',
    memory_plan: [
      'Lis les mots allemands à voix haute.',
      'Retiens une règle simple par leçon.',
      'Refais les questions sans regarder les réponses.'
    ],
    must_remember: uniqueBy(lessons.flatMap(item => [
      ...(item.lesson?.objectives || []),
      ...item.grammar.map(g => g.rule_title)
    ]), value => String(value || '').toLowerCase()).slice(0, 12),
    vocabulary,
    grammar,
    phrases,
    dialogues: lessons.flatMap(item => item.dialogues.map(d => ({
      title: d.title,
      goal: item.lesson?.topic || '',
      lines: (d.lines || []).map(line => ({
        speaker: line.speaker,
        de: line.text,
        fr: line.translation_fr
      }))
    }))),
    practice: lessons.flatMap(item => item.exercises.flatMap(ex => (ex.questions || []).map(q => ({
      question: q.question,
      answer: q.answer
    })))),
    source_lessons: lessons.length
  };
}

function completeSummary(aiSummary, lessons) {
  const fallback = fallbackSummary(lessons);
  return {
    ...fallback,
    ...aiSummary,
    source_coverage: aiSummary?.source_coverage?.length ? aiSummary.source_coverage : fallback.source_coverage,
    memory_plan: aiSummary?.memory_plan?.length ? aiSummary.memory_plan : fallback.memory_plan,
    must_remember: aiSummary?.must_remember?.length ? aiSummary.must_remember : fallback.must_remember,
    vocabulary: aiSummary?.vocabulary?.length ? aiSummary.vocabulary : fallback.vocabulary,
    grammar: aiSummary?.grammar?.length ? aiSummary.grammar : fallback.grammar,
    phrases: aiSummary?.phrases?.length ? aiSummary.phrases : fallback.phrases,
    dialogues: aiSummary?.dialogues?.length ? aiSummary.dialogues : fallback.dialogues,
    practice: aiSummary?.practice?.length ? aiSummary.practice : fallback.practice,
    source_lessons: lessons.length
  };
}

function getCachedAIPage(pageKey) {
  const [cached] = query('SELECT content_json, updated_at FROM ai_page_cache WHERE page_key = ?', [pageKey]);
  if (!cached) return null;
  const content = parseJSON(cached.content_json, null);
  return content ? { ...content, cached: true, updated_at: cached.updated_at } : null;
}

function saveCachedAIPage(pageKey, content) {
  run(
    `INSERT OR REPLACE INTO ai_page_cache (page_key, content_json, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [pageKey, JSON.stringify(content)]
  );
}

function resolveFilmSpeaker(rawSpeaker, index, speakerMap) {
  const speaker = String(rawSpeaker || '').trim();
  const normalized = speaker.toLowerCase();
  if (!speaker) return index % 2 === 0 ? 'A' : 'B';
  if (speaker.toUpperCase() === 'A' || normalized.includes('question')) return 'A';
  if (
    speaker.toUpperCase() === 'B'
    || normalized.includes('answer')
    || normalized.includes('réponse')
    || normalized.includes('reponse')
    || normalized.includes('antwort')
  ) return 'B';

  if (!speakerMap) return index % 2 === 0 ? 'A' : 'B';
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size % 2 === 0 ? 'A' : 'B');
  }
  return speakerMap.get(speaker);
}

function normalizeFilmLine(line, index = 0, speakerMap = null) {
  const rawSpeaker = String(line.speaker || '').trim();
  return {
    speaker: resolveFilmSpeaker(rawSpeaker, index, speakerMap),
    de: line.de || line.text || line.expression || '',
    fr: line.fr || line.translation_fr || '',
    ar: line.ar || line.translation_ar || '',
    action: line.action || (index === 0 ? 'enter' : 'speak'),
    source: line.source || 'pdf'
  };
}

function isWeakDialogueScene(scene) {
  const lines = scene?.lines || [];
  const speakers = new Set(lines.map(line => line.speaker).filter(Boolean));
  const hasBundledQuestions = lines.some(line => {
    const text = line.de || '';
    return (text.match(/\?/g) || []).length > 1;
  });
  return lines.length < 6 || speakers.size < 2 || hasBundledQuestions;
}

function splitGermanLine(line) {
  const text = line.de || '';
  const parts = text
    .split(/(?<=[?.!])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [line];
  return parts.map(part => ({
    ...line,
    de: part,
    fr: line.fr,
    ar: line.ar
  }));
}

function buildDialogueFilmFallback(lessons, options = {}) {
  const directDialogues = lessons.flatMap(item => (item.dialogues || [])
    .filter(d => (d.lines || []).length)
    .map(d => ({
      lesson: item.lesson,
      dialogue: d
    })));

  if (directDialogues.length) {
    const first = directDialogues[0];
    const speakerMap = new Map();
    const lines = directDialogues
      .flatMap(item => item.dialogue.lines || [])
      .map((line, index) => normalizeFilmLine(line, index, speakerMap))
      .flatMap(splitGermanLine)
      .filter(line => line.de)
      .map((line, index) => ({
        ...line,
        action: index === 0 ? 'enter' : line.action
      }));

    return {
      title: first.dialogue.title || first.lesson?.title || 'Dialogue Film',
      generated_by: 'pdf',
      source: options.structured ? 'structured_pdf_dialogue' : 'extracted_dialogue',
      ai_generated: false,
      lesson: first.lesson ? {
        id: first.lesson.id,
        title: first.lesson.title,
        topic: first.lesson.topic,
        level: first.lesson.level
      } : null,
      characters: [
        { id: 'A', name: 'Lena', role: 'Étudiante', gender: 'female' },
        { id: 'B', name: 'Samir', role: 'Étudiant', gender: 'male' }
      ],
      lines
    };
  }

  const phrases = uniqueBy(lessons.flatMap(item => [
    ...item.expressions.map(e => ({
      speaker: 'A',
      de: e.expression,
      fr: e.translation_fr,
      ar: e.translation_ar,
      action: 'speak',
      source: 'pdf_expression'
    })),
    ...item.vocabulary.filter(w => w.example_de).map(w => ({
      speaker: 'B',
      de: w.example_de,
      fr: w.example_fr,
      ar: w.translation_ar,
      action: 'speak',
      source: 'pdf_example'
    }))
  ]), item => String(item.de || '').toLowerCase()).slice(0, 10);

  return {
    title: 'Dialogue Film',
    generated_by: phrases.length ? 'local' : 'fallback',
    source: phrases.length ? 'pdf_phrases' : 'empty',
    ai_generated: false,
    lesson: lessons[0]?.lesson ? {
      id: lessons[0].lesson.id,
      title: lessons[0].lesson.title,
      topic: lessons[0].lesson.topic,
      level: lessons[0].lesson.level
    } : null,
    characters: [
      { id: 'A', name: 'Lena', role: 'Étudiante', gender: 'female' },
      { id: 'B', name: 'Samir', role: 'Étudiant', gender: 'male' }
    ],
    lines: phrases.map((line, index) => normalizeFilmLine({
      ...line,
      speaker: index % 2 === 0 ? 'A' : 'B',
      action: index === 0 ? 'enter' : 'speak'
    }, index))
  };
}

function getDialogueFilmSeedContent(lessons) {
  return {
    lessons: lessons.map(item => ({
      lesson: item.lesson,
      practice_goals: [
        ...(item.lesson?.objectives || []),
        ...item.exercises.flatMap(ex => [
          ex.instruction_de,
          ex.instruction_fr,
          ...(ex.questions || []).slice(0, 6).flatMap(q => [q.question, q.answer])
        ])
      ].filter(Boolean),
      grammar_points: item.grammar.map(g => ({
        title: g.rule_title,
        explanation_fr: g.explanation_fr,
        examples: g.examples || [],
        table: g.table || []
      })),
      extracted_dialogues: item.dialogues.map(d => ({
        title: d.title,
        lines: d.lines || []
      })),
      expressions: item.expressions,
      example_phrases: item.vocabulary
        .filter(w => w.example_de)
        .slice(0, 30)
        .map(w => ({
          word: w.word,
          de: w.example_de,
          fr: w.example_fr,
          ar: w.translation_ar
        })),
      useful_words: item.vocabulary.slice(0, 60).map(w => ({
        de: w.word,
        fr: w.translation_fr,
        ar: w.translation_ar,
        article: w.article,
        type: w.type,
        topic: w.topic,
        example_de: w.example_de
      }))
    }))
  };
}

function completeDialogueFilmScene(scene, lessons) {
  const fallback = buildDialogueFilmFallback(lessons);
  const speakerMap = new Map();
  const lines = (scene?.lines || [])
    .map((line, index) => normalizeFilmLine({
      ...line,
      source: scene.source || 'ai_from_pdf'
    }, index, speakerMap))
    .filter(line => line.de);

  return {
    ...fallback,
    ...scene,
    title: scene?.title || fallback.title,
    characters: scene?.characters?.length ? scene.characters : fallback.characters,
    lines: lines.length ? lines : fallback.lines,
    ai_generated: true,
    generated_by: 'ai',
    source: 'ai_from_pdf'
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.UPLOAD_MAX_SIZE_MB || 25) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Type non supporté.'));
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    const { path: filePath, mimetype } = req.file;
    const fileBuffer = fs.readFileSync(filePath);
    let lesson;
    let extractedTextLength = 0;
    let extractedText = '';
    let extractionWarning = null;

    console.log(`📥 Upload started: ${req.file.originalname} (${mimetype})`);

    if (mimetype === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(fileBuffer);
        extractedText = String(data.text || '').trim();
        extractedTextLength = extractedText.length;
        console.log(`📝 Text extracted: ${extractedTextLength} chars`);
      } catch (e) {
        console.error('❌ Text extraction failed:', e.message);
      }

      // 🔧 PRIORITÉ: Analyse directe du PDF par Gemini (plus complète qu'extraction texte)
      // Gemini a meilleur OCR et comprend mieux la structure PDF
      console.log('📄 Analyzing PDF directly with Gemini...');
      try {
        lesson = await analyzeLessonFile(fileBuffer, mimetype);
        console.log(`✅ Gemini analysis complete: "${lesson.lesson?.title}" | Words: ${(lesson.vocabulary || []).length} | Grammar: ${(lesson.grammar || []).length}`);
      } catch (e) {
        console.warn(`⚠️ Direct Gemini PDF analysis failed: ${e.message}`);
        if (extractedText.length >= Number(process.env.PDF_TEXT_MIN_CHARS || 200)) {
          console.log('📝 Trying extracted text analysis with configured AI provider/fallback...');
          lesson = await analyzeLessonText(extractedText);
          console.log(`✅ Text analysis complete: "${lesson.lesson?.title}" | Words: ${(lesson.vocabulary || []).length} | Grammar: ${(lesson.grammar || []).length}`);
        } else {
          throw e;
        }
      }
      
      // Si le résultat semble incomplet, essayer l'extraction texte comme fallback
      if (isEmptyDocumentAnalysis(lesson) || !lessonHasContent(lesson) || lessonLooksTooThinForSource(lesson, { textLength: extractedTextLength, fileSize: fileBuffer.length })) {
        console.log('⚠️ Gemini result looks incomplete, trying text extraction fallback...');
        try {
          if (extractedText.length >= Number(process.env.PDF_TEXT_MIN_CHARS || 200)) {
            const textLesson = await analyzeLessonText(extractedText);
            console.log(`✅ Text analysis complete: Words: ${(textLesson.vocabulary || []).length} | Grammar: ${(textLesson.grammar || []).length}`);
            // Compare and use the lesson with more content
            const origCount = lessonContentCount(lesson);
            const textCount = lessonContentCount(textLesson);
            console.log(`📊 Content count: Gemini=${origCount} vs Text=${textCount}`);
            if (textCount > origCount) {
              lesson = textLesson;
              console.log('✅ Using text analysis (more content)');
            }
          }
        } catch (e) {
          console.error('❌ Text extraction failed:', e.message);
          // Keep the PDF analysis result
        }
      }
    } else {
      console.log('🖼️ Analyzing image/document with Gemini...');
      lesson = await analyzeLessonFile(fileBuffer, mimetype);
      console.log(`✅ Analysis complete: "${lesson.lesson?.title}"`);
    }

    if (lessonLooksTooThinForSource(lesson, { textLength: extractedTextLength, fileSize: fileBuffer.length })) {
      console.log('🧩 Enriching incomplete Gemini lesson from extracted PDF text...');
      lesson = enrichLessonFromExtractedText(lesson, extractedText);
      extractionWarning = 'Le PDF a été importé, mais l’analyse IA semblait partielle. Le backend a complété la leçon avec le texte extrait du PDF.';
      console.log(`✅ Enriched lesson: Words=${(lesson.vocabulary || []).length} | Grammar=${(lesson.grammar || []).length}`);
    }
    lesson = cleanLessonVocabulary(lesson);

    fs.unlinkSync(filePath);

    if (isEmptyDocumentAnalysis(lesson) || !lessonHasContent(lesson)) {
      console.error('❌ Upload rejected: lesson is empty');
      return res.status(422).json({
        error: extractedTextLength >= Number(process.env.PDF_TEXT_MIN_CHARS || 200)
          ? 'Le PDF contient du texte, mais aucune leçon exploitable n’a pu être créée. Essaie avec un PDF plus net ou un modèle Gemini plus fort pour PDF/image.'
          : 'Le PDF semble vide ou scanné sans texte exploitable. Essaie une image plus nette ou active un modèle Gemini plus fort pour l’OCR.'
      });
    }

    if (lessonLooksTooThinForSource(lesson, { textLength: extractedTextLength, fileSize: fileBuffer.length })) {
      extractionWarning = extractionWarning ||
        'La leçon a été sauvegardée, mais elle semble incomplète par rapport au PDF. Tu peux utiliser “✨ Améliorer” pour générer une version pédagogique plus riche.';
      console.warn('⚠️ Upload accepted with partial extraction warning');
    }

    // 🔧 STRICT MATCHING: Check if PDF belongs to an existing lesson (rule-based, not AI)
    const existingLessonsRaw = query(
      'SELECT id, title, level, unit, topic FROM lessons WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.userId]
    );

    let lessonId, merged_with_existing_lesson = false;

    // Use strict rule-based matching
    if (existingLessonsRaw.length > 0) {
      const match = matchLessonToExistingDirect(lesson, existingLessonsRaw);
      if (match.should_merge && match.existing_lesson_id) {
        // Merge with existing lesson
        lessonId = match.existing_lesson_id;
        merged_with_existing_lesson = true;
        console.log(`✅ MERGING with existing lesson ${lessonId}: ${match.reason}`);
      } else {
        // Create new lesson
        const lessonMeta = {
          title: lesson.lesson?.title || 'Leçon sans titre',
          level: lesson.lesson?.level || 'A1',
          unit: lesson.lesson?.unit || null,
          topic: lesson.lesson?.topic || null,
          objectives: lesson.lesson?.objectives || []
        };
        const result = createLesson(req.userId, lessonMeta);
        lessonId = result.lessonId;
        merged_with_existing_lesson = result.merged;
        console.log(`📌 CREATING NEW lesson ${lessonId}: ${match.reason}`);
      }
    } else {
      // No existing lessons, create new
      const lessonMeta = {
        title: lesson.lesson?.title || 'Leçon sans titre',
        level: lesson.lesson?.level || 'A1',
        unit: lesson.lesson?.unit || null,
        topic: lesson.lesson?.topic || null,
        objectives: lesson.lesson?.objectives || []
      };
      const result = createLesson(req.userId, lessonMeta);
      lessonId = result.lessonId;
      merged_with_existing_lesson = result.merged;
      console.log(`📌 FIRST lesson created ${lessonId}`);
    }

    // ── Save vocabulary ───────────────────────────────────────────────
    const savedWords = [];
    for (const w of (lesson.vocabulary || [])) {
      const exists = query('SELECT id FROM words WHERE user_id = ? AND lesson_id = ? AND word = ?', [req.userId, lessonId, w.word]);
      if (exists.length > 0) {
        ensureReviewSchedule(exists[0].id);
        savedWords.push({ ...w, id: exists[0].id, duplicate: true });
        continue;
      }
      const r = run(
        `INSERT INTO words
           (user_id, word, article, plural, type, translation_fr, translation_ar,
            example_de, example_fr, level, topic, lesson_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.userId, w.word, w.article, w.plural, w.type,
         w.translation_fr, w.translation_ar,
         w.example_de, w.example_fr,
         w.level || 'A1', w.topic, lessonId]
      );

      // 🔧 FIX : Sécuriser également la récupération de l'ID du mot
      let wordId = Number(r?.lastInsertRowid || r?.lastID || r?.id);
      if (!Number.isInteger(wordId) || wordId <= 0) {
        const dbRes = query('SELECT last_insert_rowid() as id');
        wordId = Number(dbRes[0].id);
      }
      if (!Number.isInteger(wordId) || wordId <= 0) {
        throw new Error("Impossible de récupérer l'ID du mot créé.");
      }
      ensureReviewSchedule(wordId);
      savedWords.push({ ...w, id: wordId });
    }

    // ── Save grammar rules ────────────────────────────────────────────
    for (const g of (lesson.grammar || [])) {
      const exists = query(
        'SELECT id FROM grammar_rules WHERE lesson_id = ? AND lower(rule_title) = lower(?) LIMIT 1',
        [lessonId, g.rule_title || '']
      );
      if (exists.length) continue;
      run(
        `INSERT INTO grammar_rules
           (lesson_id, rule_title, explanation_fr, explanation_ar,
            examples_json, table_json)
         VALUES (?,?,?,?,?,?)`,
        [lessonId, g.rule_title, g.explanation_fr, g.explanation_ar,
         JSON.stringify(g.examples || []),
         JSON.stringify(g.table    || [])]
      );
    }

    // ── Save dialogues ────────────────────────────────────────────────
    for (const d of (lesson.dialogues || [])) {
      const exists = query(
        `SELECT id FROM dialogues
         WHERE lesson_id = ? AND (lower(title) = lower(?) OR lines_json = ?)
         LIMIT 1`,
        [lessonId, d.title || '', JSON.stringify(d.lines || [])]
      );
      if (exists.length) continue;
      run(
        `INSERT INTO dialogues (lesson_id, title, lines_json)
         VALUES (?,?,?)`,
        [lessonId, d.title, JSON.stringify(d.lines || [])]
      );
    }

    // ── Save expressions ──────────────────────────────────────────────
    for (const e of (lesson.expressions || [])) {
      const exists = query(
        `SELECT e.id
         FROM expressions e
         JOIN lessons l ON l.id = e.lesson_id
         WHERE l.user_id = ? AND e.expression = ?`,
        [req.userId, e.expression]
      );
      if (!exists.length) {
        run(
          `INSERT INTO expressions
             (lesson_id, expression, translation_fr, translation_ar, context)
           VALUES (?,?,?,?,?)`,
          [lessonId, e.expression, e.translation_fr, e.translation_ar, e.context]
        );
      } else {
        run('UPDATE expressions SET lesson_id = ? WHERE id = ?', [lessonId, exists[0].id]);
      }
    }

    // ── Save exercises ────────────────────────────────────────────────
    for (const ex of (lesson.exercises || [])) {
      const exists = query(
        `SELECT id FROM exercises
         WHERE lesson_id = ?
           AND COALESCE(type, '') = COALESCE(?, '')
           AND COALESCE(instruction_de, '') = COALESCE(?, '')
           AND COALESCE(instruction_fr, '') = COALESCE(?, '')
         LIMIT 1`,
        [lessonId, ex.type || '', ex.instruction_de || '', ex.instruction_fr || '']
      );
      if (exists.length) continue;
      run(
        `INSERT INTO exercises
           (lesson_id, type, instruction_de, instruction_fr, questions_json)
         VALUES (?,?,?,?,?)`,
        [lessonId, ex.type, ex.instruction_de, ex.instruction_fr,
         JSON.stringify(ex.questions || [])]
      );
    }

    invalidateSummaryCache();
    dedupeLessonContent(lessonId, req.userId);

    // Verify lesson was saved
    const verifyLesson = query('SELECT id, title FROM lessons WHERE id = ? AND user_id = ?', [lessonId, req.userId]);
    const verifyWords = query('SELECT COUNT(*) as count FROM words WHERE lesson_id = ?', [lessonId]);
    console.log(`✅ UPLOAD COMPLETE:`);
    console.log(`   Lesson: ${verifyLesson.length > 0 ? 'SAVED ✅' : 'NOT FOUND ❌'}`);
    console.log(`   Words: ${verifyWords[0]?.count || 0} saved`);

    res.json({
      success:    true,
      lesson_id:  lessonId,
      merged_with_existing_lesson,
      lesson:     lesson.lesson,
      new_words:  savedWords.filter(w => !w.duplicate).length,
      vocabulary: savedWords,
      grammar:    lesson.grammar    || [],
      dialogues:  lesson.dialogues  || [],
      expressions:lesson.expressions|| [],
      exercises:  lesson.exercises  || [],
      warning: extractionWarning,
      extracted_text_length: extractedTextLength
    });

  } catch (err) {
    console.error('Upload error:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(err.status || 500).json({
      error: err.message || 'Erreur lors de l\'analyse.',
      code: err.code,
      retryDelay: err.retryDelay
    });
  }
});

// Get all lessons
router.get('/lessons', (req, res) => {
  mergeDuplicateLessonsForUser(req.userId);
  const lessons = query(`
    SELECT l.*,
      (SELECT COUNT(*) FROM words w WHERE w.lesson_id = l.id) as word_count,
      (SELECT COUNT(*) FROM grammar_rules g WHERE g.lesson_id = l.id) as grammar_count,
      (SELECT COUNT(*) FROM dialogues d WHERE d.lesson_id = l.id) as dialogue_count,
      (SELECT COUNT(*) FROM expressions e WHERE e.lesson_id = l.id) as expression_count,
      (SELECT COUNT(*) FROM exercises ex WHERE ex.lesson_id = l.id) as exercise_count
    FROM lessons l
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC
  `, [req.userId]);
  res.json(lessons.map(l => ({
    ...l,
    objectives: JSON.parse(l.objectives_json || '[]')
  })));
});

// Get single lesson with all content
router.get('/lessons/:id', (req, res) => {
  // 🔧 FIX : Forcer la lecture de l'ID en nombre exact
  const lessonId = Number(req.params.id);

  const [lesson] = query('SELECT * FROM lessons WHERE id = ? AND user_id = ?', [lessonId, req.userId]);
  if (!lesson) return res.status(404).json({ error: 'Leçon non trouvée.' });

  const words = query('SELECT * FROM words WHERE lesson_id = ? AND user_id = ?', [lessonId, req.userId]);
  const grammar = query('SELECT * FROM grammar_rules WHERE lesson_id = ?', [lessonId]);
  const dialogues = query('SELECT * FROM dialogues WHERE lesson_id = ?', [lessonId]);
  const expressions = query('SELECT * FROM expressions WHERE lesson_id = ?', [lessonId]);
  const exercises = query('SELECT * FROM exercises WHERE lesson_id = ?', [lessonId]);

  res.json({
    lesson: { ...lesson, objectives: JSON.parse(lesson.objectives_json || '[]') },
    words,
    grammar: grammar.map(g => ({
      ...g,
      examples: JSON.parse(g.examples_json || '[]'),
      table:    JSON.parse(g.table_json    || '[]')
    })),
    dialogues: dialogues.map(d => ({
      ...d,
      lines: JSON.parse(d.lines_json || '[]')
    })),
    expressions,
    exercises: exercises.map(e => ({
      ...e,
      questions: JSON.parse(e.questions_json || '[]')
    }))
  });
});

router.get('/summary', async (req, res) => {
  try {
    const lessons = getFullLessons(req.userId);
    if (!lessons.length) return res.json(fallbackSummary([]));
    const signature = getLessonSignature(lessons);
    const cached = getCachedSummary(signature);
    if (cached) return res.json(cached);

    try {
      const summary = await summarizeLessonsForReview(lessons);
      const completed = { ...completeSummary(summary, lessons), generated_by: 'ai', cached: false };
      saveSummaryCache(completed, signature);
      res.json(completed);
    } catch (err) {
      console.error('Summary AI error:', err.message);
      const fallback = { ...fallbackSummary(lessons), cached: false };
      saveSummaryCache(fallback, signature);
      res.json(fallback);
    }
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du résumé.' });
  }
});

router.get('/basics', (req, res) => {
  try {
    const lessons = getFullLessons(req.userId);
    const signature = getLessonSignature(lessons);
    const cached = getCachedAIPage(`basics:${signature}`);
    if (cached) return res.json(cached);
    res.json({
      title: 'Bases allemand A1/A2',
      cached: false,
      needs_update: true,
      source_lessons: lessons.length,
      learning_order: [],
      sections: [],
      daily_plan: [],
      practice: []
    });
  } catch (err) {
    console.error('Basics cache error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des bases.' });
  }
});

router.post('/basics/update', async (req, res) => {
  try {
    const lessons = getFullLessons(req.userId);
    const signature = getLessonSignature(lessons);
    const basics = await generateGermanBasics(lessons);
    const content = {
      ...basics,
      generated_by: 'ai',
      cached: false,
      needs_update: false,
      source_lessons: lessons.length
    };
    saveCachedAIPage(`basics:${signature}`, content);
    res.json(content);
  } catch (err) {
    console.error('Basics AI error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Erreur lors de la génération des bases IA.',
      code: err.code,
      retryDelay: err.retryDelay
    });
  }
});

router.get('/dialogue-film', async (req, res) => {
  try {
    const lessons = getFullLessons(req.userId);
    if (!lessons.length) return res.json(buildDialogueFilmFallback([]));

    const signature = getDialogueFilmSignature(lessons);
    const mode = req.query.mode === 'raw' ? 'raw' : 'smart';
    const refresh = req.query.refresh === '1';
    const cacheKey = `dialogue-film:${mode}:${signature}`;
    const cached = refresh ? null : getCachedAIPage(cacheKey);
    if (cached) return res.json(cached);

    const fallback = buildDialogueFilmFallback(lessons, { structured: mode === 'smart' });
    const hasPhrases = fallback.lines.length > 0;

    if (mode === 'raw' || !hasPhrases) {
      const content = { ...fallback, cached: false };
      saveCachedAIPage(cacheKey, content);
      return res.json(content);
    }

    try {
      const scene = await generateDialogueFilmScene(getDialogueFilmSeedContent(lessons));
      const content = {
        ...completeDialogueFilmScene(scene, lessons),
        cached: false
      };
      saveCachedAIPage(cacheKey, content);
      return res.json(content);
    } catch (err) {
      console.error('Dialogue film AI error:', err.message);
      const content = {
        ...fallback,
        cached: false,
        ai_generated: false,
        ai_error: err.message
      };
      saveCachedAIPage(cacheKey, content);
      return res.json(content);
    }
  } catch (err) {
    console.error('Dialogue film error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du Dialogue Film.' });
  }
});

// Re-analyze existing lesson (re-upload)
router.delete('/lessons/:id', (req, res) => {
  const id = req.params.id;
  const [lesson] = query('SELECT id FROM lessons WHERE id = ? AND user_id = ?', [id, req.userId]);
  if (!lesson) return res.status(404).json({ error: 'Leçon non trouvée.' });
  run('DELETE FROM exercises   WHERE lesson_id = ?', [id]);
  run('DELETE FROM expressions WHERE lesson_id = ?', [id]);
  run('DELETE FROM dialogues   WHERE lesson_id = ?', [id]);
  run('DELETE FROM grammar_rules WHERE lesson_id = ?', [id]);
  run('DELETE FROM review_schedule WHERE word_id IN (SELECT id FROM words WHERE lesson_id = ?)', [id]);
  run('DELETE FROM words       WHERE lesson_id = ?', [id]);
  run('DELETE FROM lessons     WHERE id = ?', [id]);
  invalidateSummaryCache();
  res.json({ success: true });
});

module.exports = router;
