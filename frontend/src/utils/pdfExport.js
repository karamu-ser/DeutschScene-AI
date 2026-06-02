const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const MARGIN_TOP = 54;
const LINE_HEIGHT = 15;
const MAX_LINES = 48;

function cleanText(value) {
  return String(value || '')
    .replace(/ß/g, 'ss')
    .replace(/ẞ/g, 'SS')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value) {
  return cleanText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text, maxChars = 86) {
  const words = cleanText(text).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function addLine(lines, text = '', options = {}) {
  lines.push({
    text: cleanText(text),
    size: options.size || 10,
    bold: Boolean(options.bold)
  });
}

function buildVocabularyLines(words) {
  const lines = [];
  addLine(lines, 'DeutschScene AI - Vocabulaire', { size: 18, bold: true });
  addLine(lines, `Total: ${words.length} mots`, { size: 10 });
  addLine(lines, '');

  words.forEach((word, index) => {
    const displayWord = [word.article, word.word].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    addLine(lines, `${index + 1}. ${displayWord || 'Mot sans titre'}`, { size: 13, bold: true });
    addLine(lines, `Type: ${word.type || '-'} | Niveau: ${word.level || '-'} | Theme: ${word.topic || '-'}`);
    addLine(lines, `FR: ${word.translation_fr || '-'}`);
    if (word.plural) addLine(lines, `Plural: ${word.plural}`);

    const examples = [
      word.example_de && `Exemple DE: ${word.example_de}`,
      word.example_fr && `Exemple FR: ${word.example_fr}`
    ].filter(Boolean);

    if (examples.length) {
      examples.forEach(example => {
        wrapLine(example).forEach(line => addLine(lines, line));
      });
    } else {
      const base = cleanText(word.word).replace(/^(der|die|das)\s+/i, '');
      addLine(lines, `Exemple DE: Ich lerne das Wort "${base}".`);
      addLine(lines, `Exemple FR: J'apprends le mot "${base}".`);
    }
    addLine(lines, '');
  });
  return lines;
}

function paginate(lines) {
  const pages = [];
  for (let i = 0; i < lines.length; i += MAX_LINES) {
    pages.push(lines.slice(i, i + MAX_LINES));
  }
  return pages.length ? pages : [[{ text: 'Aucun vocabulaire a exporter.', size: 12 }]];
}

function pageContent(lines, pageNumber, pageCount) {
  const commands = [
    'BT',
    `/F1 10 Tf`,
    `${MARGIN_X} ${PAGE_HEIGHT - MARGIN_TOP} Td`
  ];

  lines.forEach((line, index) => {
    if (index > 0) commands.push(`0 -${LINE_HEIGHT} Td`);
    commands.push(`/F${line.bold ? 2 : 1} ${line.size} Tf`);
    commands.push(`(${escapePdfText(line.text)}) Tj`);
  });

  commands.push('ET');
  commands.push('BT');
  commands.push('/F1 8 Tf');
  commands.push(`${MARGIN_X} 30 Td`);
  commands.push(`(Page ${pageNumber} / ${pageCount}) Tj`);
  commands.push('ET');
  return commands.join('\n');
}

function buildPdf(pages) {
  const objects = [];
  const addObject = content => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];

  pages.forEach((lines, index) => {
    const content = pageContent(lines, index + 1, pages.length);
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function downloadVocabularyPdf(words, filename = 'deutschscene-vocabulary.pdf') {
  const pages = paginate(buildVocabularyLines(words));
  const pdf = buildPdf(pages);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
