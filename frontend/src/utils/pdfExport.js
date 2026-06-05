function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function displayWord(word) {
  const raw = String(word.word || '').replace(/^(der|die|das)\s+/i, '').trim();
  return [word.article, raw].filter(Boolean).join(' ');
}

function wordCard(word, index) {
  const examples = [
    word.example_de && `<p class="example"><strong>DE</strong> ${escapeHtml(word.example_de)}</p>`,
    word.example_fr && `<p class="example"><strong>FR</strong> ${escapeHtml(word.example_fr)}</p>`
  ].filter(Boolean).join('');

  return `
    <article class="word-card">
      <div class="word-head">
        <span class="index">${index + 1}</span>
        <div>
          <h2>${escapeHtml(displayWord(word) || 'Mot sans titre')}</h2>
          <p class="meta">
            ${escapeHtml(word.type || 'mot')}
            ${word.level ? ` · ${escapeHtml(word.level)}` : ''}
            ${word.topic ? ` · ${escapeHtml(word.topic)}` : ''}
          </p>
        </div>
      </div>
      <div class="translations">
        <p><strong>Français</strong><span>${escapeHtml(word.translation_fr || '-')}</span></p>
        ${word.translation_ar ? `<p dir="rtl"><strong>العربية</strong><span>${escapeHtml(word.translation_ar)}</span></p>` : ''}
      </div>
      ${word.plural ? `<p class="small"><strong>Pluriel</strong> ${escapeHtml(word.plural)}</p>` : ''}
      ${examples || `<p class="example"><strong>DE</strong> Ich lerne das Wort "${escapeHtml(String(word.word || '').replace(/^(der|die|das)\s+/i, ''))}".</p>`}
    </article>
  `;
}

function buildVocabularyHtml(words) {
  const generatedAt = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>DeutschScene AI - Vocabulaire</title>
  <style>
    @page { margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #171717;
      background: #fff;
      font-family: Inter, "Segoe UI", Arial, "Noto Sans Arabic", sans-serif;
      line-height: 1.45;
    }
    header {
      border-bottom: 3px solid #e8c547;
      padding-bottom: 16px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      letter-spacing: 0;
    }
    .subtitle {
      margin: 0;
      color: #555;
      font-size: 13px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .summary div {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px 12px;
      background: #fafafa;
    }
    .summary strong {
      display: block;
      font-size: 20px;
    }
    .summary span {
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .word-card {
      break-inside: avoid;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 13px;
      background: #fff;
    }
    .word-head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }
    .index {
      width: 28px;
      height: 28px;
      display: inline-grid;
      place-items: center;
      border-radius: 50%;
      background: #e8c547;
      color: #111;
      font-weight: 800;
      flex: 0 0 auto;
    }
    h2 {
      margin: 0;
      font-size: 18px;
    }
    .meta,
    .small {
      margin: 2px 0 0;
      color: #666;
      font-size: 12px;
    }
    .translations {
      display: grid;
      gap: 6px;
      margin-bottom: 8px;
    }
    .translations p,
    .example {
      margin: 0;
      border-radius: 6px;
      background: #f6f6f6;
      padding: 7px 8px;
      font-size: 13px;
    }
    .translations strong,
    .example strong,
    .small strong {
      color: #222;
      margin-right: 6px;
    }
    .translations span {
      color: #333;
    }
    .example {
      margin-top: 6px;
    }
    footer {
      margin-top: 20px;
      color: #777;
      font-size: 11px;
      text-align: center;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header>
    <h1>DeutschScene AI - Vocabulaire</h1>
    <p class="subtitle">Fiche exportée le ${escapeHtml(generatedAt)} · prête pour impression ou PDF</p>
  </header>
  <section class="summary">
    <div><strong>${words.length}</strong><span>Mots</span></div>
    <div><strong>${new Set(words.map(word => word.topic).filter(Boolean)).size}</strong><span>Thèmes</span></div>
    <div><strong>${new Set(words.map(word => word.level).filter(Boolean)).size || 1}</strong><span>Niveaux</span></div>
  </section>
  <main class="grid">
    ${words.length ? words.map(wordCard).join('') : '<p>Aucun vocabulaire à exporter.</p>'}
  </main>
  <footer>DeutschScene AI · Vocabulaire généré depuis tes leçons</footer>
</body>
</html>`;
}

export function downloadVocabularyPdf(words, filename = 'deutschscene-vocabulary.pdf') {
  const html = buildVocabularyHtml(words);
  const title = filename.replace(/\.pdf$/i, '');
  const printWindow = window.open('', '_blank', 'width=960,height=720');

  if (!printWindow) {
    printFromIframe(html, title);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 450);
}

function printFromIframe(html, title) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeWindow = iframe.contentWindow;
  if (!iframeWindow) {
    iframe.remove();
    return;
  }

  iframeWindow.document.open();
  iframeWindow.document.write(html);
  iframeWindow.document.close();
  iframeWindow.document.title = title;

  window.setTimeout(() => {
    iframeWindow.focus();
    iframeWindow.print();
    window.setTimeout(() => iframe.remove(), 1000);
  }, 450);
}
