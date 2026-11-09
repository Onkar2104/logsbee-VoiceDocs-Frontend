import html2pdf from 'html2pdf.js'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function normalizeContent(content) {
  if (!content) return '<p></p>'
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return content
  return content.split(/\r?\n/).map((line) => '<p>' + (escapeHtml(line) || '<br>') + '</p>').join('')
}

function safeFileName(title) {
  return (title || 'VoiceDocs document')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? '-' : character
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'VoiceDocs document'
}

function buildExportHtml(title, content) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title>' +
    '<style>body{font-family:Arial,sans-serif;color:#202124;font-size:11pt;line-height:1.6}h1{font-size:22pt;margin:0 0 22pt}h2{font-size:16pt;margin-top:18pt}p{margin:0 0 9pt}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px}blockquote{border-left:3px solid #94a3b8;margin-left:0;padding-left:12px;color:#475569}a{color:#1d4ed8;text-decoration:underline}</style>' +
    '</head><body><h1>' + escapeHtml(title) + '</h1>' + normalizeContent(content) + '</body></html>'
}

function textRunsFromNode(node, marks = {}) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ? [new TextRun({ text: node.nodeValue, ...marks })] : []
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return []

  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return [new TextRun({ text: '\n', ...marks })]
  if (tag === 'img') {
    const alt = node.getAttribute('alt')
    return alt ? [new TextRun({ text: '[Image: ' + alt + ']', italics: true })] : []
  }

  const nextMarks = {
    ...marks,
    ...(tag === 'strong' || tag === 'b' ? { bold: true } : {}),
    ...(tag === 'em' || tag === 'i' ? { italics: true } : {}),
    ...(tag === 'u' ? { underline: {} } : {}),
    ...(tag === 's' || tag === 'del' ? { strike: true } : {}),
    ...(tag === 'code' ? { font: 'Consolas' } : {}),
  }

  return Array.from(node.childNodes).flatMap((child) => textRunsFromNode(child, nextMarks))
}

function paragraphFromElement(element) {
  const tag = element.tagName.toLowerCase()
  const runs = Array.from(element.childNodes).flatMap((node) => textRunsFromNode(node))
  const options = { children: runs.length ? runs : [new TextRun(' ')] }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1))
    options.heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level - 1]
  }

  if (tag === 'li') options.bullet = { indent: 360 }
  if (tag === 'blockquote') options.indent = { left: 720 }
  if (element.style?.textAlign === 'center') options.alignment = AlignmentType.CENTER
  if (element.style?.textAlign === 'right') options.alignment = AlignmentType.RIGHT
  return new Paragraph(options)
}

function htmlToWordParagraphs(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const body = parsed.body
  const blocks = Array.from(body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre'))
  const topLevelBlocks = blocks.filter((element) => !element.parentElement.closest('li,blockquote,pre'))
  const paragraphs = topLevelBlocks.map((element) => paragraphFromElement(element))

  body.querySelectorAll('table tr').forEach((row) => {
    const cells = Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent.trim())
    if (cells.length) paragraphs.push(new Paragraph({ children: [new TextRun(cells.join('   |   '))] }))
  })

  if (!paragraphs.length && body.textContent.trim()) {
    paragraphs.push(new Paragraph({ text: body.textContent.trim() }))
  }
  return paragraphs
}

export async function downloadDocumentPdf(title, content) {
  const container = document.createElement('div')
  container.innerHTML = buildExportHtml(title, content)
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;padding:36px;background:#fff;'
  document.body.appendChild(container)
  try {
    await html2pdf().set({
      margin: [12, 14, 12, 14],
      filename: safeFileName(title) + '.pdf',
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    }).from(container).save()
  } finally { container.remove() }
}

export async function downloadDocumentWord(title, content) {
  const html = normalizeContent(content)
  const children = [
    new Paragraph({ text: title || 'VoiceDocs document', heading: HeadingLevel.TITLE }),
    ...htmlToWordParagraphs(html),
  ]
  const wordDocument = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(wordDocument)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeFileName(title) + '.docx'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
