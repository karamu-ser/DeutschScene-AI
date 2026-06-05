const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL    = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const API_OPTS = { apiVersion: 'v1beta' };

const CONVERSATION_LEVEL_GUIDE = {
  A1: 'phrases tres courtes, vocabulaire de base, present, une question simple a la fois',
  A2: 'phrases simples, vocabulaire courant, petites reponses de 2 a 4 phrases',
  B1: 'dialogue naturel mais clair, phrases moyennes, reformulations utiles',
  B2: 'conversation fluide, nuances moderees, expressions courantes',
  C1: 'conversation avancee, vocabulaire precis, style naturel',
  C2: 'conversation tres avancee, idiomes et nuances fines, sans devenir artificiel'
};

const LESSON_ANALYSIS_PROMPT = `
Tu es un professeur d'allemand expert pour tous les niveaux A1 à C2. Analyse COMPLÈTEMENT ce document de cours et extrait TOUT le contenu pédagogique.

🔴 RÈGLE ABSOLUE : Tu DOIS remplir TOUS les champs avec TOUS les éléments du document.
- Ne laisse JAMAIS un tableau vide [] si le document contient du contenu pour ce champ.
- Si le document a des mots, TOUS les mots doivent être extraits.
- Extrais TOUS les mots, expressions, verbes, phrases utiles et éléments de vocabulaire présents dans le document.
- Ne limite pas la réponse à 5 ou 10 éléments.
- Pour chaque page, extrais tous les éléments visibles.
- Si le document contient 50 mots, retourne 50 mots.
- Si le document contient 150 mots, retourne 150 mots.
- N'extrais pas les chaînes qui semblent être des mots collés par erreur OCR/PDF.
- Exemples à rejeter : Straßedie, Sportder, Stationdie, Versicherungdie, heißtkeinbeiSchwein, neuheuteFeuerzeugVerkäuferDeutschHäuser, ichmanchmalMilchlächerlichBücherKircheeuchfeuchtechtGesprächmöchteKüche.
- Si une chaîne contient plusieurs mots collés, sépare-la seulement si c'est évident. Sinon, ignore-la.
- N'utilise jamais des traductions génériques ou placeholders comme "élément extrait du PDF", "عنصر مستخرج من الملف", "mot important de la leçon" ou "important word from the lesson".
- Si tu ne connais pas la traduction exacte, mets null.
- Si un élément extrait n'a pas de sens lexical ou pédagogique clair, supprime-le de vocabulary.
- Ne mets pas dans vocabulary des fragments PDF/OCR, bouts de titres, mots collés, numéros, en-têtes, pieds de page ou textes de navigation.
- Si l'élément est une lettre, un son, une terminaison ou une règle de prononciation, ne le mets jamais dans vocabulary.
- Les éléments comme Ä, Ö, Ü, ß, au, ei, eu, ie, sch, ch, st, sp, -er, -tion, -ung doivent aller dans grammar/examples, jamais dans vocabulary.
- N'ajoute pas chaque token extrait dans vocabulary. Classe mentalement les éléments ainsi :
  vocabulary = mots allemands utiles pour l'apprenant, avec article si nom ;
  expressions = salutations et phrases utiles comme Hallo, Guten Morgen ;
  verbs = verbes infinitifs utiles, type "verb" dans vocabulary seulement si forme infinitive ;
  grammar_terms = mots techniques de cours comme Verb, Endung, Subjekt, Präsens, jamais dans vocabulary ;
  proper_nouns = noms, villes, pays, personnes comme Berlin, Müller, Türkei, jamais dans vocabulary ;
  rejected_items = OCR cassé ou fragments inutiles, jamais dans le JSON.
- Les éléments vocabulary doivent avoir un article correct si ce sont des noms, translation_fr, translation_ar, et example_de si disponible.
- Si translation_fr ou translation_ar est inconnue, mets null. Ne mets jamais de placeholder.
- Ne classe jamais comme noun : W-Fragen comme Wann, Wo, Warum ; salutations comme Hallo, Guten Morgen ; verbes conjugués comme heißt, heiße, grüße, hängt ; chaînes OCR cassées comme Wowohnstdu.
- Si le document a des tableaux de grammaire, TOUS les tableaux doivent être extraits.
- Si le document a des exercices, TOUS les exercices doivent être extraits.

MODE EXTRACTION MAXIMUM :
1. Lis le document ENTIÈREMENT page par page, section par section
2. Extrait CHAQUE mot allemand visible + article, pluriel, traductions complètes (FR et AR), exemples
3. Extrait CHAQUE verbe visible, même s'il apparait dans un exemple ou un exercice
4. Extrait CHAQUE règle grammaticale + tous les tableaux de conjugaison/déclinaison complets
5. Extrait CHAQUE dialogue, conversation ou exemple de discussion
6. Extrait CHAQUE expression, salutation, phrase utile
7. Extrait CHAQUE exercice avec TOUTES les questions et réponses
8. Si le document contient des images/tableaux, transforme-les en JSON structuré
9. Si une section a peu de détails, ajoute-la quand même : ne supprime rien

OBJECTIF MINIMUM :
- Pour un PDF normal : minimum 30+ mots, 3-5 règles, 2+ dialogues/expressions, tous les exercices
- Si le document contient plus de contenu → le JSON doit contenir plus de contenu

Garde le niveau réel du document : A1, A2, B1, B2, C1 ou C2.
N'invente rien, mais extrais TOUT ce qui est visible.

Retourne UNIQUEMENT ce JSON (sans backticks, sans markdown, sans commentaires) :

{
  "lesson": {
    "title": "titre exact de la leçon",
    "level": "A1",
    "unit": "numéro unité ou null",
    "topic": "thème",
    "objectives": ["objectif 1", "objectif 2"]
  },
  "vocabulary": [
    {
      "word": "mot allemand (avec article si nom, ex: die Schule)",
      "article": "der/die/das ou null",
      "plural": "pluriel ou null",
      "type": "noun/verb/adjective/adverb/phrase/other",
      "translation_fr": "traduction française",
      "translation_ar": "الترجمة بالعربية",
      "example_de": "exemple en allemand",
      "example_fr": "traduction de l'exemple",
      "level": "A1",
      "topic": "thème"
    }
  ],
  "grammar": [
    {
      "rule_title": "nom de la règle grammaticale",
      "explanation_fr": "explication complète en français",
      "explanation_ar": "شرح بالعربية",
      "examples": [
        { "de": "exemple allemand", "fr": "traduction" }
      ],
      "table": [
        {
          "header": ["Personne", "haben", "sein"],
          "rows": [
            ["ich", "habe", "bin"],
            ["du", "hast", "bist"],
            ["er/sie/es", "hat", "ist"],
            ["wir", "haben", "sind"],
            ["ihr", "habt", "seid"],
            ["sie/Sie", "haben", "sind"]
          ]
        }
      ]
    }
  ],
  "dialogues": [
    {
      "title": "titre du dialogue",
      "lines": [
        { "speaker": "A", "text": "texte allemand", "translation_fr": "traduction", "translation_ar": "الترجمة" }
      ]
    }
  ],
  "expressions": [
    {
      "expression": "expression allemande",
      "translation_fr": "traduction française",
      "translation_ar": "الترجمة بالعربية",
      "context": "contexte d'utilisation"
    }
  ],
  "exercises": [
    {
      "type": "fill_blank/multiple_choice/translate/conjugate",
      "instruction_de": "consigne en allemand",
      "instruction_fr": "consigne en français",
      "questions": [
        { "question": "Ich ___ Student. (sein)", "answer": "bin", "options": ["bin", "bist", "ist", "sind"] }
      ]
    }
  ]
}

RÈGLES STRICTES :
1. vocabulary : extrais CHAQUE mot allemand visible dans le document, même dans les tableaux et exercices
2. grammar : si le document contient des conjugaisons ou tableaux grammaticaux, extrais-les TOUS avec leurs tableaux complets
3. dialogues : si le document contient des conversations ou exemples de dialogue, extrais-les
4. expressions : extrais toutes les formules de politesse, salutations, questions types
5. exercises : si le document contient des exercices, extrais les questions et réponses
6. Pour les verbes : inclus la conjugaison complète dans grammar.table
7. Ne mets JAMAIS [] si le document contient du contenu pour ce champ
8. Si tu hésites entre ignorer un élément et l'inclure, inclus-le.
9. Ne retourne pas une leçon pauvre pour un document riche.
`;

const PRONUNCIATION_PROMPT = `
Tu es un assistant pédagogique pour l'apprentissage de l'allemand.
L'étudiant devait prononcer : "{expected}"
Le système de reconnaissance vocale a transcrit : "{spoken}"

Améliore le feedback pour qu'il soit :
- encourageant et motivant ;
- précis sur ce qui est réussi et ce qui doit être amélioré ;
- clair, avec un exemple concret ;
- accompagné d'une suggestion courte pour progresser ;
- positif et bienveillant.

Retourne UNIQUEMENT ce JSON :
{"score":<0-100>,"correct_words":[...],"wrong_words":[...],"feedback_fr":"conseil en français","feedback_ar":"نصيحة بالعربية الدارجة"}
`;

const LESSON_SUMMARY_PROMPT = `
Tu es un professeur d'allemand A1/A2 très patient. Transforme toutes les leçons données en UNE SEULE grande leçon intelligente, complète, très claire et très simple à retenir.

OBJECTIF :
- couvrir 100% des leçons fournies : aucune leçon source ne doit disparaître
- garder tout ce qui est important : mots, règles, dialogues, exercices, exemples
- expliquer comme à un enfant intelligent : phrases courtes, logique pas à pas, zéro jargon inutile
- structurer comme une fiche de révision
- utiliser du français simple
- garder les mots/phrases allemands exacts pour la prononciation
- NE PAS diviser par leçon importée
- fusionner les doublons et organiser par logique pédagogique
- si une règle contient des sous-points (ex: W-Fragen), explique CHAQUE sous-point séparément : wer, was, wo, woher, wie, wann, warum si présent
- donne plusieurs exemples pour chaque sous-point important

Retourne UNIQUEMENT ce JSON valide :
{
  "title": "Résumé intelligent A1/A2",
  "overview": "résumé global en 3 à 5 phrases simples",
  "source_coverage": [
    { "lesson_title": "titre source", "covered_in": "où cette leçon est expliquée dans le résumé" }
  ],
  "memory_plan": ["étape courte 1", "étape courte 2", "étape courte 3"],
  "must_remember": ["point essentiel 1", "point essentiel 2"],
  "vocabulary": [
    {
      "de": "mot allemand avec article si utile",
      "fr": "traduction française",
      "ar": "traduction arabe si disponible",
      "memory": "astuce très courte",
      "example_de": "phrase allemande simple",
      "example_fr": "traduction française",
      "group": "salutations/personnes/verbes/alphabet/questions/autre"
    }
  ],
  "grammar": [
    {
      "title": "nom de la règle",
      "simple": "explication très simple",
      "pattern": "forme à retenir",
      "child_explanation": "explication comme pour un enfant, avec une image mentale simple",
      "steps": ["étape 1", "étape 2", "étape 3"],
      "subrules": [
        {
          "name": "wer / wie / wo...",
          "meaning": "sens en français",
          "when_to_use": "quand l'utiliser",
          "examples": [
            { "de": "Wer bist du?", "fr": "Qui es-tu ?" },
            { "de": "Wer ist das?", "fr": "Qui est-ce ?" }
          ]
        }
      ],
      "examples": [
        { "de": "exemple allemand", "fr": "traduction" }
      ],
      "common_mistakes": ["erreur fréquente + correction simple"]
    }
  ],
  "phrases": [
    {
      "de": "phrase/expression allemande",
      "fr": "traduction",
      "ar": "traduction arabe si disponible",
      "use": "quand l'utiliser"
    }
  ],
  "dialogues": [
    {
      "title": "dialogue type",
      "goal": "objectif du dialogue",
      "lines": [
        { "speaker": "A", "de": "texte allemand", "fr": "traduction" }
      ]
    }
  ],
  "practice": [
    {
      "question": "question courte",
      "answer": "réponse correcte"
    }
  ]
}

RÈGLES :
1. Tu dois couvrir toutes les leçons du tableau d'entrée. Remplis source_coverage avec chaque leçon source.
2. Ne supprime pas les mots importants. Si beaucoup de mots existent, garde tous les mots utiles A1/A2.
3. Pour vocabulary, donne tous les mots essentiels, regroupés intelligemment.
4. Pour grammar, regroupe les règles répétées, mais explique tous les sous-points.
5. Pour une règle "W-Fragen", crée une subrule pour chaque mot interrogatif présent ou utile : wer, was, wo, woher, wie, wann.
6. Chaque subrule importante doit avoir au moins 2 exemples allemands très simples.
7. Pour phrases, inclus expressions et phrases utiles des dialogues.
8. Le résultat doit se lire comme UNE leçon complète, pas comme plusieurs leçons.
9. Aucun markdown, aucun commentaire, seulement le JSON.
`;

const BASICS_PROMPT = `
Tu es un professeur d'allemand A1/A2 très patient. Crée une page "Bases IA" complète pour apprendre l'allemand efficacement.

OBJECTIF :
- construire les bases importantes de l'allemand A1/A2
- expliquer très simplement en français, comme à un enfant qui débute
- donner beaucoup d'exemples allemands écoutables
- organiser pour mémoriser vite
- utiliser les bases générales ET les leçons importées quand elles existent
- si les leçons importées contiennent un sujet comme W-Fragen, Artikel, Akkusativ, etc., explique ce sujet en détail
- chaque notion doit répondre : "c'est quoi ?", "quand je l'utilise ?", "comment je construis la phrase ?", "exemples"

Retourne UNIQUEMENT ce JSON valide :
{
  "title": "Bases allemand A1/A2",
  "updated_note": "phrase courte",
  "learning_order": ["étape 1", "étape 2", "étape 3"],
  "sections": [
    {
      "title": "Alphabet et prononciation",
      "why": "pourquoi c'est important",
      "rules": [
        {
          "name": "nom simple",
          "explanation": "explication simple",
          "like_child": "explication très facile avec image mentale",
          "steps": ["étape 1", "étape 2", "étape 3"],
          "subrules": [
            {
              "name": "wer / wie / wo...",
              "meaning": "sens en français",
              "when_to_use": "quand l'utiliser",
              "examples": [
                { "de": "Wie heißt du?", "fr": "Comment tu t'appelles ?" },
                { "de": "Wie geht es dir?", "fr": "Comment ça va ?" }
              ]
            }
          ],
          "examples": [
            { "de": "exemple allemand", "fr": "traduction ou son" }
          ],
          "common_mistakes": ["erreur fréquente + correction"]
        }
      ],
      "words": [
        { "de": "mot allemand", "fr": "français", "ar": "arabe si utile", "memory": "astuce" }
      ],
      "phrases": [
        { "de": "phrase allemande", "fr": "traduction", "use": "utilisation" }
      ]
    }
  ],
  "daily_plan": [
    { "day": "Jour 1", "task": "activité", "goal": "objectif" }
  ],
  "practice": [
    { "question": "question", "answer": "réponse" }
  ]
}

SECTIONS OBLIGATOIRES :
1. Alphabet et prononciation
2. Articles der/die/das et noms
3. Pronoms personnels
4. Verbes essentiels au présent : sein, haben, heißen, kommen, wohnen, sprechen
5. Questions W : wer, was, wo, woher, wie, wann
6. Salutations et présentations
7. Nombres, jours et temps
8. Phrases de survie en classe
9. Ordre des mots simple
10. Méthode de mémorisation

RÈGLES :
- Donne au moins 8 sections.
- Chaque section doit contenir des exemples allemands.
- Si une section parle des W-Fragen, explique séparément wer, was, wo, woher, wie, wann avec au moins 2 exemples chacun.
- Si une section parle des articles, explique der/die/das, ein/eine, et donne beaucoup d'exemples.
- Si une section parle de l'Akkusativ, explique avec une image simple : "qui reçoit l'action ?" et donne des exemples.
- Utilise les leçons importées comme matière principale quand elles existent.
- Aucun markdown, seulement JSON.
`;

const DIALOGUE_FILM_PROMPT = `
Tu es un professeur d'allemand A1/A2 et scénariste pédagogique. Transforme le contenu réel extrait du PDF en UNE vraie mini-scène dialoguée naturelle entre deux personnages.

IMPORTANT :
- Le résultat doit ressembler à un petit film éducatif, pas à une liste de phrases.
- Le dialogue doit être basé sur les leçons importées et utiliser TOUTES les notions importantes : vocabulaire, grammaire, expressions, objectifs et exercices.
- Crée une progression claire : salutation → situation réelle → questions → réponses → correction douce → mini-récap → clôture.
- Utilise en priorité les phrases allemandes fournies, puis complète avec des phrases A1 simples.
- Si la leçon contient W-Fragen, utilise plusieurs questions séparées : wer, was, wo, woher, wie, wann selon le contenu.
- Si la leçon contient articles ou Akkusativ, montre la notion dans des phrases naturelles, par exemple "Ich sehe den Mann" ou "Das ist ein Tisch" selon le niveau.
- Chaque règle importante doit apparaître au moins une fois dans une réplique.
- Les mots utiles fournis doivent apparaître autant que possible, sans rendre le dialogue bizarre.
- Tu peux ajouter de petites phrases A1 très simples seulement si elles rendent le dialogue naturel, par exemple "Guten Morgen!", "Und du?", "Danke!", "Auf Wiedersehen!".
- Niveau A1/A2, phrases courtes.
- Une réplique = une seule phrase allemande courte. Ne regroupe pas plusieurs questions dans la même bulle.
- Si une ligne PDF contient plusieurs questions, sépare-les en plusieurs répliques.
- Alterne vraiment les personnages A et B.
- Retourne UNIQUEMENT ce JSON valide :
{
  "title": "titre court",
  "generated_by": "ai",
  "source": "suggested_enrichment",
  "characters": [
    { "id": "A", "name": "Lena", "role": "Étudiante", "gender": "female" },
    { "id": "B", "name": "Samir", "role": "Étudiant", "gender": "male" }
  ],
  "lines": [
    {
      "speaker": "A",
      "de": "phrase allemande",
      "fr": "traduction française",
      "ar": "الترجمة بالعربية",
      "action": "enter/speak/listen/gesture"
    }
  ]
}

RÈGLES :
1. 12 à 18 répliques si nécessaire pour couvrir les notions.
2. Alterne A et B autant que possible.
3. Maximum 10 mots allemands par réplique.
4. Garde les traductions françaises et arabes quand elles sont fournies.
5. Si tu ajoutes une traduction manquante, reste simple.
6. Évite les répétitions inutiles.
7. Ne mets jamais trois questions dans une seule réplique.
8. Ne saute pas une notion importante présente dans "grammar_points", "useful_words", "expressions" ou "practice_goals".
9. Aucun markdown, seulement JSON.
`;

const ENHANCED_LESSON_PROMPT = `
Tu es un expert pédagogique en allemand langue étrangère, spécialisé dans l'apprentissage immersif, la progression CECRL et la mémorisation active.

Ta mission: tu as analysé un chapitre de manuel allemand. Transforme la leçon JSON ci-dessous en une expérience d'apprentissage moderne, vivante et beaucoup plus efficace pour un apprenant adulte de niveau {niveau}.

Objectifs prioritaires:
1. Transformer le contenu scolaire classique en scènes de vie réelle.
2. Créer un bon équilibre Vocabulaire / Grammaire / Communication.
3. Organiser la progression du plus simple au plus complexe.
4. Proposer des exercices variés et progressifs: compréhension, production, oral, grammaire.
5. Ajouter des astuces culturelles allemandes quand pertinent.
6. Rendre le tout motivant, adulte, concret et immédiatement utilisable.
7. Adapter précisément la difficulté au niveau {niveau}.

Contraintes de niveau:
- A1/A2: phrases allemandes courtes, vocabulaire courant, consignes très simples.
- B1/B2: ajoute connecteurs, nuances utiles et tâches de production plus ouvertes.
- C1/C2: ajoute registre, précision stylistique, idiomes naturels et reformulation.

Retourne UNIQUEMENT ce JSON valide, sans markdown:
{
  "title": "titre de la leçon",
  "attractive_title": "titre attractif et moderne",
  "level": "{niveau}",
  "objective_fr": "objectif clair en français",
  "objectives": [
    "objectif concret 1",
    "objectif concret 2",
    "objectif communicationnel 3"
  ],
  "progression": [
    { "step": "étape", "goal_fr": "objectif de cette étape", "estimated_minutes": 3 }
  ],
  "opening_scene": {
    "title": "DeutschScene - titre court",
    "context_fr": "contexte réaliste en français",
    "dialogue": [
      { "speaker": "A", "de": "phrase allemande", "fr": "traduction française", "audio_text": "texte à répéter" }
    ],
    "comprehension_questions": [
      { "question_fr": "question simple", "answer_fr": "réponse", "evidence_de": "phrase allemande source" }
    ]
  },
  "deutsch_scenes": [
    {
      "title": "DeutschScene - titre court",
      "real_life_context_fr": "situation de vie réelle",
      "communication_goal_fr": "ce que l'apprenant apprend à faire",
      "dialogue": [
        { "speaker": "A", "de": "phrase allemande", "fr": "traduction française", "audio_text": "texte à répéter", "target": "vocabulaire ou grammaire visé" }
      ],
      "quick_check": [
        { "question_fr": "question de compréhension", "answer_fr": "réponse attendue" }
      ]
    }
  ],
  "vocabulary": [
    {
      "de": "mot/expression allemand",
      "article": "der/die/das ou null",
      "fr": "traduction",
      "example_de": "exemple naturel",
      "usage_note_fr": "mini-note d'usage",
      "priority": "high/medium",
      "communication_use_fr": "à quoi sert ce mot dans la vraie vie"
    }
  ],
  "grammar_in_context": [
    {
      "title": "règle",
      "explanation_fr": "explication simple",
      "examples": [
        { "de": "exemple", "fr": "traduction" }
      ],
      "common_mistakes": [
        { "wrong": "forme incorrecte", "correct": "forme correcte", "why_fr": "pourquoi" }
      ],
      "communication_use_fr": "quand utiliser cette règle dans une conversation"
    }
  ],
  "communication_tasks": [
    {
      "title": "tâche de communication",
      "instruction_fr": "ce que l'apprenant doit produire",
      "support_phrases": ["phrase utile 1", "phrase utile 2"]
    }
  ],
  "culture_tips": [
    {
      "title": "astuce culturelle",
      "tip_fr": "explication courte",
      "example_de": "phrase allemande liée si pertinent"
    }
  ],
  "guided_dialogues": [
    {
      "title": "mini-dialogue progressif",
      "goal_fr": "objectif",
      "lines": [
        { "speaker": "A", "de": "phrase", "fr": "traduction" }
      ],
      "reuse_focus": ["mot ou règle à réutiliser"]
    }
  ],
  "interactive_exercises": [
    {
      "type": "comprehension/production/translation/fill_blank/word_order/oral_challenge",
      "instruction_fr": "consigne",
      "prompt": "question ou phrase",
      "answer": "réponse attendue",
      "hint_fr": "indice court"
    }
  ],
  "final_challenge": {
    "mission_fr": "mission réaliste",
    "requirements": ["élément obligatoire 1", "élément obligatoire 2"],
    "model_answer_de": "réponse modèle en allemand",
    "model_answer_fr": "traduction"
  },
  "feedback": {
    "answers": [
      { "exercise_prompt": "rappel", "answer": "réponse" }
    ],
    "encouragement_fr": "feedback encourageant",
    "next_steps": ["prochaine action courte"]
  }
}

Règles:
1. Utilise d'abord le contenu réel de la leçon fournie.
2. Tu peux ajouter des phrases naturelles uniquement pour rendre la scène praticable.
3. Ne fais pas une leçon trop longue: privilégie 2 à 3 DeutschScenes fortes, 5 à 8 exercices, et du vocabulaire prioritaire.
4. Tous les exemples allemands doivent être utiles à l'oral.
5. Les astuces culturelles doivent être concrètes, pas touristiques ni clichées.
6. Le résultat doit être prêt à être affiché dans une application web.
`;

const ENHANCED_DIALOGUE_PROMPT = `
Tu es un expert pédagogique en allemand langue étrangère et coach de conversation.

Ta mission: améliorer le dialogue allemand ci-dessous pour qu'il soit plus naturel, fluide et utile pour un apprenant de niveau {niveau}.

Critères d'amélioration:
- Rendre le langage plus authentique: expressions courantes, particules modales, contractions naturelles si adaptées au niveau.
- Ajouter des émotions et du contexte.
- Varier la longueur des répliques.
- Inclure du vocabulaire utile et des structures grammaticales cibles.
- Ajouter 2 à 3 répliques pour prolonger la conversation.
- Garder le dialogue compréhensible et praticable à l'oral.

Contraintes de niveau:
- A1/A2: reste simple, phrases courtes, très peu de particules, vocabulaire quotidien.
- B1/B2: ajoute doch, mal, denn, eigentlich, connecteurs, petites reformulations naturelles.
- C1/C2: ajoute nuances, registre, idiomes naturels, sans rendre le dialogue théâtral.

Retourne UNIQUEMENT ce JSON valide, sans markdown:
{
  "title": "titre court",
  "level": "{niveau}",
  "context_fr": "contexte et émotion de la scène",
  "improved_dialogue": [
    {
      "speaker": "A",
      "de": "réplique allemande naturelle",
      "fr": "traduction française",
      "tone": "émotion ou intention courte",
      "target": "vocabulaire ou structure utile"
    }
  ],
  "changes_explained": [
    "explication courte en français"
  ],
  "useful_language": [
    {
      "de": "expression ou structure",
      "fr": "sens",
      "why_fr": "pourquoi c'est utile"
    }
  ],
  "oral_challenge": {
    "instruction_fr": "défi oral court",
    "model_answer_de": "réponse modèle"
  }
}

Règles:
1. Préserve l'objectif du dialogue original.
2. Ne corrige pas seulement: rends la conversation plus vivante.
3. Ajoute seulement 2 à 3 répliques nouvelles.
4. Si le dialogue original contient des erreurs, corrige-les discrètement.
5. Chaque réplique doit rester utile pour apprendre à parler.
`;

const PREMIUM_CONTENT_PROMPT = `
Tu es un "Content Enhancer" premium pour l'apprentissage de l'allemand.

Prends le contenu ci-dessous et fais-le passer au niveau supérieur pour un apprenant adulte de niveau {niveau}.

Améliorations demandées:
- Plus d'authenticité culturelle allemande, quand c'est pertinent.
- Meilleure fluidité et naturel dans les phrases allemandes.
- Meilleure pédagogie: explications claires, exemples utiles, pratique active.
- Plus d'engagement émotionnel: contexte, intention, motivation, sentiment de progression.
- Adaptation optimale au niveau {niveau}.

Contraintes de niveau:
- A1/A2: phrases courtes, vocabulaire fréquent, explications très simples, tâches guidées.
- B1/B2: langage plus naturel, connecteurs, reformulations, production plus ouverte.
- C1/C2: nuances, registre, précision, idiomes naturels, style plus authentique.

Retourne UNIQUEMENT ce JSON valide, sans markdown:
{
  "title": "titre premium",
  "level": "{niveau}",
  "premium_version": {
    "overview_fr": "résumé motivant de la version améliorée",
    "content_sections": [
      {
        "title": "section",
        "explanation_fr": "explication pédagogique claire",
        "examples": [
          { "de": "exemple allemand naturel", "fr": "traduction française", "note_fr": "pourquoi c'est utile" }
        ],
        "practice": [
          { "type": "comprehension/production/oral/grammar/vocabulary", "prompt": "consigne", "answer": "réponse ou modèle" }
        ]
      }
    ],
    "authenticity_upgrades": [
      { "de": "expression naturelle", "fr": "sens", "usage_fr": "quand l'utiliser" }
    ],
    "culture_notes": [
      { "title": "note culturelle", "fr": "explication courte et concrète", "example_de": "exemple si utile" }
    ],
    "emotional_hook": {
      "context_fr": "situation vivante",
      "learner_mission_fr": "mission motivante"
    },
    "next_step_fr": "action concrète pour progresser"
  }
}

Règles:
1. Préserve le sens du contenu original.
2. N'ajoute pas de culture allemande artificielle si ce n'est pas pertinent.
3. La version premium doit être directement affichable dans une application web.
4. Mets l'apprenant en action: chaque section importante doit avoir une pratique.
`;

function getModel(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL }, API_OPTS);
}

function extractRetryDelay(message) {
  const match = String(message || '').match(/retryDelay[":\s]+(\d+)s/i)
    || String(message || '').match(/Please retry in ([\d.]+)s/i);
  if (!match) return null;
  return Math.ceil(Number(match[1]));
}

function normalizeGeminiError(error) {
  const message = error?.message || String(error);
  const retryDelay = extractRetryDelay(message);

  if (message.includes('429') || /quota/i.test(message) || /Too Many Requests/i.test(message)) {
    const wait = retryDelay ? ` Réessaie dans environ ${retryDelay} secondes, ou plus tard si la limite quotidienne est atteinte.` : '';
    const err = new Error(`Quota Gemini dépassé pour le modèle ${MODEL}.${wait}`);
    err.code = 'GEMINI_QUOTA_EXCEEDED';
    err.status = 429;
    err.retryDelay = retryDelay;
    err.originalMessage = message;
    return err;
  }

  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid') || message.includes('403')) {
    const err = new Error('Clé Gemini invalide ou non autorisée. Vérifie GEMINI_API_KEY dans backend/.env.');
    err.code = 'GEMINI_API_KEY_INVALID';
    err.status = 401;
    err.originalMessage = message;
    return err;
  }

  if (message.includes('404') || message.includes('not found')) {
    const err = new Error(`Modèle Gemini introuvable: ${MODEL}. Vérifie GEMINI_MODEL dans backend/.env.`);
    err.code = 'GEMINI_MODEL_NOT_FOUND';
    err.status = 400;
    err.originalMessage = message;
    return err;
  }

  const err = new Error(`Erreur Gemini: ${message}`);
  err.code = 'GEMINI_ERROR';
  err.status = 502;
  err.originalMessage = message;
  return err;
}

async function generateContent(model, payload) {
  try {
    return await model.generateContent(payload);
  } catch (error) {
    throw normalizeGeminiError(error);
  }
}

function cleanJSON(text) {
  return text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
    .trim();
}

async function analyzeLessonFile(fileBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const model = getModel(apiKey);
  const result = await generateContent(model, [
    LESSON_ANALYSIS_PROMPT,
    { inlineData: { data: fileBuffer.toString('base64'), mimeType } }
  ]);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid JSON: ' + e.message);
  }
}

async function analyzeLessonText(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const model = getModel(apiKey);
  const maxAnalysisChars = Number(process.env.GEMINI_ANALYSIS_MAX_CHARS || 60000);
  const fullText = String(text || '').slice(0, maxAnalysisChars);
  const result = await generateContent(
    model,
    LESSON_ANALYSIS_PROMPT + `\n\nVoici le contenu du document à analyser. Analyse tout ce contenu et retourne une leçon complète, sans te limiter aux premiers éléments :\n\n${fullText}`
  );
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error('Gemini returned invalid JSON: ' + e.message);
  }
}

async function extractVocabulary(fileBuffer, mimeType) {
  const lesson = await analyzeLessonFile(fileBuffer, mimeType);
  return lesson.vocabulary || [];
}

async function extractVocabularyFromText(text) {
  const lesson = await analyzeLessonText(text);
  return lesson.vocabulary || [];
}

async function checkPronunciation(expected, spoken) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const model = getModel(apiKey);
  const result = await generateContent(
    model,
    PRONUNCIATION_PROMPT.replace('{expected}', expected).replace('{spoken}', spoken)
  );
  try {
    return JSON.parse(cleanJSON(result.response.text()));
  } catch (e) {
    const score = expected.toLowerCase() === spoken.toLowerCase() ? 100 : 50;
    return {
      score,
      correct_words: score === 100 ? [expected] : [],
      wrong_words:   score < 100  ? [expected] : [],
      feedback_fr:   score === 100 ? 'Parfait !' : "Continue à t'entraîner !",
      feedback_ar:   score === 100 ? 'ممتاز!'    : 'زيد تمرن!'
    };
  }
}

async function summarizeLessonsForReview(lessons) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const model = getModel(apiKey);
  const payload = JSON.stringify(lessons).slice(0, 60000);
  const result = await generateContent(model, `${LESSON_SUMMARY_PROMPT}\n\nLEÇONS À RÉSUMER :\n${payload}`);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Summary parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid summary JSON: ' + e.message);
  }
}

async function generateGermanBasics(lessons = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const model = getModel(apiKey);
  const payload = JSON.stringify(lessons).slice(0, 50000);
  const result = await generateContent(
    model,
    `${BASICS_PROMPT}\n\nLEÇONS IMPORTÉES À EXPLIQUER AUSSI :\n${payload}`
  );
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Basics parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid basics JSON: ' + e.message);
  }
}

async function generateDialogueFilmScene(content) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const model = getModel(apiKey);
  const result = await generateContent(
    model,
    `${DIALOGUE_FILM_PROMPT}\n\nCONTENU RÉEL EXTRAIT DU PDF :\n${JSON.stringify(content).slice(0, 30000)}`
  );
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Dialogue film parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid dialogue film JSON: ' + e.message);
  }
}

async function generateConversationReply({ level, topic, userText, history = [], topicVocabulary = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const normalizedLevel = CONVERSATION_LEVEL_GUIDE[level] ? level : 'A1';
  const model = getModel(apiKey);
  const payload = {
    level: normalizedLevel,
    topic: topic || 'Alltag',
    userText,
    history: history.slice(-8),
    topicVocabulary: topicVocabulary.slice(0, 20)
  };

  const prompt = `
Tu es un partenaire de conversation allemand patient pour apprenants.

Objectif: continuer une vraie conversation en allemand, en adaptant strictement ton niveau a l'utilisateur.

Niveau utilisateur: ${normalizedLevel}
Guide de niveau: ${CONVERSATION_LEVEL_GUIDE[normalizedLevel]}
Theme: ${payload.topic}

Regles importantes:
- Reponds en allemand avec un niveau EXACTEMENT adapte.
- A1/A2: phrases tres simples, pas de structures difficiles, 1 question simple a la fin.
- B1/B2: dialogue naturel, clair, avec une question de relance.
- C1/C2: vocabulaire avance mais utile, correction plus nuancee.
- Ne surcharge jamais un debutant.
- Corrige seulement les erreurs importantes.
- Si l'utilisateur fait une phrase correcte, encourage-le et propose une petite amelioration.
- Retourne UNIQUEMENT un JSON valide, sans markdown.

Format JSON obligatoire:
{
  "reply_de": "reponse en allemand",
  "translation_fr": "traduction francaise",
  "translation_ar": "الترجمة العربية",
  "correction": "correction simple en francais, ou 'Aucune erreur importante.'",
  "useful_words": [
    { "de": "mot allemand", "fr": "traduction francaise", "ar": "ترجمة عربية" }
  ]
}

Contexte JSON:
${JSON.stringify(payload).slice(0, 25000)}
`;

  const result = await generateContent(model, prompt);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Conversation parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid conversation JSON: ' + e.message);
  }
}

async function generateAiLehrerReply({ lessonContent, userAnswer, expectedAnswer, question = null, history = [], level = 'A1' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const normalizedLevel = CONVERSATION_LEVEL_GUIDE[level] ? level : 'A1';
  const model = getModel(apiKey);
  const payload = {
    level: normalizedLevel,
    lessonContent,
    question,
    userAnswer,
    expectedAnswer,
    history: history.slice(-8)
  };

  const prompt = `
Tu es "AI Lehrer", un professeur d'allemand patient construit a partir d'une lecon PDF.

Flux pedagogique:
- Une question a deja ete posee a l'utilisateur.
- Tu dois verifier sa reponse, donner un feedback, et creer une petite Practice Session si une erreur existe.
- Ne pose pas une nouvelle question dans cette reponse. La prochaine question sera demandee apres la pratique.

Priorite absolue:
1. Utilise d'abord le vocabulaire, les regles, les exemples et dialogues de lessonContent.
2. Si tu ajoutes une Practice Session, elle doit etre marquee from_pdf:false et based_on_pdf:true.
3. Ne passe pas trop vite a la suite: corrige, fais repeter, puis propose une pratique ciblee.
4. Adapte la difficulte au niveau ${normalizedLevel}.
5. Explique en francais simple, avec allemand exact pour la phrase correcte.
6. Le feedback doit etre positif, precis et motivant: nomme un point fort, un axe d'amelioration, explique pourquoi avec un exemple, puis donne une action concrete pour progresser.

Retourne UNIQUEMENT ce JSON valide:
{
  "mode": "gemini",
  "level": "${normalizedLevel}",
  "is_correct": false,
  "score": 0,
  "feedback_fr": "feedback bienveillant en francais: point fort + axe d'amélioration + explication + exemple + action concrete",
  "feedback_ar": "شرح قصير بالعربية",
  "correct_answer": "phrase correcte attendue",
  "mistake": {
    "mistake_type": "word_order/conjugation/article/plural/vocabulary/pronunciation/spelling/wrong_preposition/wrong_case/missing_verb/wrong_w_question",
    "expected": "phrase attendue",
    "user_answer": "reponse utilisateur",
    "related_rule": "regle du PDF si disponible"
  },
  "practice_session": {
    "title": "Practice Session",
    "focus": "type d'erreur",
    "related_rule": "regle liee",
    "exercises": [
      {
        "id": "practice-1",
        "type": "word_order/fill_blank/translate/article/conjugation/rewrite",
        "prompt_fr": "consigne en francais",
        "prompt_de": "consigne en allemand ou null",
        "answer": "reponse attendue",
        "from_pdf": false,
        "based_on_pdf": true
      }
    ],
    "from_pdf": false,
    "based_on_pdf": true
  }
}

Si la reponse est correcte, mets is_correct:true, score entre 90 et 100, mistake:{}, et practice_session avec exercises:[].

Contexte JSON:
${JSON.stringify(payload).slice(0, 45000)}
`;

  const result = await generateContent(model, prompt);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('AI Lehrer parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid AI Lehrer JSON: ' + e.message);
  }
}

async function generateStoryFromLesson({ lessonContent, level = 'A1' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const normalizedLevel = CONVERSATION_LEVEL_GUIDE[level] ? level : 'A1';
  const model = getModel(apiKey);
  const prompt = `
Tu es un professeur d'allemand. Cree une petite histoire adaptee au niveau ${normalizedLevel}.

Regles:
- Utilise principalement les mots, phrases, exemples et structures de la lecon PDF.
- Ajoute traduction francaise et arabe.
- Ajoute des questions de comprehension.
- Decoupe l'audio phrase par phrase via audio_text.
- Comme l'histoire est generee, elle doit etre dans suggested_enrichment avec from_pdf:false et based_on_pdf:true.
- Retourne UNIQUEMENT un JSON valide, sans markdown.

Format:
{
  "story_title": "titre",
  "level": "${normalizedLevel}",
  "based_on_lesson_id": "",
  "suggested_enrichment": {
    "from_pdf": false,
    "based_on_pdf": true
  },
  "paragraphs": [
    {
      "de": "phrase ou court paragraphe allemand",
      "fr": "traduction francaise",
      "ar": "الترجمة العربية",
      "audio_text": "texte allemand a prononcer"
    }
  ],
  "comprehension_questions": [
    {
      "question_de": "question simple en allemand",
      "question_fr": "traduction francaise",
      "answer": "reponse attendue"
    }
  ]
}

Contenu PDF normalise:
${JSON.stringify(lessonContent).slice(0, 45000)}
`;

  const result = await generateContent(model, prompt);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Story parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid story JSON: ' + e.message);
  }
}

async function generateEnhancedLesson({ lessonContent, level = 'A1' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const normalizedLevel = CONVERSATION_LEVEL_GUIDE[level] ? level : (lessonContent?.lesson?.level || 'A1');
  const model = getModel(apiKey);
  const prompt = `${ENHANCED_LESSON_PROMPT.replaceAll('{niveau}', normalizedLevel)}

LEÇON ACTUELLE JSON:
${JSON.stringify(lessonContent).slice(0, 50000)}
`;

  const result = await generateContent(model, prompt);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Enhanced lesson parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid enhanced lesson JSON: ' + e.message);
  }
}

async function generateEnhancedDialogue({ dialogue, level = 'A1', lessonContent = null }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const normalizedLevel = CONVERSATION_LEVEL_GUIDE[level] ? level : (lessonContent?.lesson?.level || 'A1');
  const model = getModel(apiKey);
  const payload = {
    level: normalizedLevel,
    dialogue,
    lessonContext: lessonContent ? {
      lesson: lessonContent.lesson,
      vocabulary: lessonContent.vocabulary?.slice(0, 30),
      grammar: lessonContent.grammar?.slice(0, 8),
      expressions: lessonContent.expressions?.slice(0, 20)
    } : null
  };
  const prompt = `${ENHANCED_DIALOGUE_PROMPT.replaceAll('{niveau}', normalizedLevel)}

DIALOGUE ACTUEL ET CONTEXTE JSON:
${JSON.stringify(payload).slice(0, 35000)}
`;

  const result = await generateContent(model, prompt);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Enhanced dialogue parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid enhanced dialogue JSON: ' + e.message);
  }
}

async function generatePremiumContent({ content, level = 'A1', context = null }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const normalizedLevel = CONVERSATION_LEVEL_GUIDE[level] ? level : 'A1';
  const model = getModel(apiKey);
  const payload = {
    level: normalizedLevel,
    content,
    context
  };
  const prompt = `${PREMIUM_CONTENT_PROMPT.replaceAll('{niveau}', normalizedLevel)}

CONTENU À AMÉLIORER JSON/TEXTE:
${JSON.stringify(payload).slice(0, 45000)}
`;

  const result = await generateContent(model, prompt);
  const clean = cleanJSON(result.response.text());
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Premium content parse error:', clean.substring(0, 500));
    throw new Error('Gemini returned invalid premium content JSON: ' + e.message);
  }
}

function normalizeTextForComparison(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function areTopicsSimilar(topic1, topic2, similarity_threshold = 0.6) {
  if (!topic1 || !topic2) return false;
  const t1 = normalizeTextForComparison(topic1);
  const t2 = normalizeTextForComparison(topic2);
  
  if (t1 === t2) return true;
  
  // Check if topics share key words
  const words1 = new Set(t1.split(/\s+/));
  const words2 = new Set(t2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w) && w.length > 3);
  const union = new Set([...words1, ...words2]);
  const jaccard = intersection.length / union.size;
  
  return jaccard >= similarity_threshold;
}

function matchLessonToExistingDirect(analyzedLesson, existingLessons) {
  // 🔧 STRICT MATCHING LOGIC (not AI-based, rule-based)
  // Only merge if:
  // 1. Same level
  // 2. Same or very similar topic
  // 3. Same unit (if specified)
  
  if (!existingLessons || existingLessons.length === 0) {
    return { should_merge: false, existing_lesson_id: null, confidence: 0, reason: 'No existing lessons' };
  }

  const newLevel = analyzedLesson.lesson?.level || 'A1';
  const newTopic = analyzedLesson.lesson?.topic;
  const newUnit = analyzedLesson.lesson?.unit;
  const newTitle = analyzedLesson.lesson?.title;

  for (const existing of existingLessons) {
    // RULE 1: Level must match
    if (existing.level !== newLevel) {
      console.log(`❌ Level mismatch: ${existing.level} vs ${newLevel}`);
      continue;
    }

    // RULE 2: Topic must be same or very similar
    if (!newTopic && !existing.topic) {
      // Both have no topic - only merge if title is very similar
      const titleSim = normalizeTextForComparison(existing.title) === normalizeTextForComparison(newTitle);
      if (!titleSim) {
        console.log(`❌ No topic and different title: "${existing.title}" vs "${newTitle}"`);
        continue;
      }
    } else if (newTopic && existing.topic) {
      const topicMatch = areTopicsSimilar(existing.topic, newTopic, 0.7);
      if (!topicMatch) {
        console.log(`❌ Topic mismatch: "${existing.topic}" vs "${newTopic}"`);
        continue;
      }
    } else {
      // One has topic, other doesn't - don't merge
      console.log(`❌ Topic presence mismatch: "${existing.topic}" vs "${newTopic}"`);
      continue;
    }

    // RULE 3: Unit must match if both are specified
    if (existing.unit && newUnit && existing.unit !== newUnit) {
      console.log(`❌ Unit mismatch: ${existing.unit} vs ${newUnit}`);
      continue;
    }

    // All rules passed - MERGE!
    console.log(`✅ MERGE: Found matching lesson ${existing.id} for "${newTitle}"`);
    return {
      should_merge: true,
      existing_lesson_id: existing.id,
      confidence: 95,
      reason: `Même niveau (${newLevel}), même sujet (${newTopic})`
    };
  }

  // No match found
  return {
    should_merge: false,
    existing_lesson_id: null,
    confidence: 0,
    reason: 'Aucune leçon existante correspondante (niveau, sujet)'
  };
}

module.exports = {
  analyzeLessonFile,
  analyzeLessonText,
  extractVocabulary,
  extractVocabularyFromText,
  checkPronunciation,
  summarizeLessonsForReview,
  generateGermanBasics,
  generateDialogueFilmScene,
  generateConversationReply,
  generateAiLehrerReply,
  generateStoryFromLesson,
  generateEnhancedLesson,
  generateEnhancedDialogue,
  generatePremiumContent,
  matchLessonToExistingDirect
};
