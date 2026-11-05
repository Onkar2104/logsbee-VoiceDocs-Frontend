import html2pdf from 'html2pdf.js'
import HTMLtoDOCX from 'html-to-docx'

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function normalizeContent(content) {
  if (!content) return '<p></p>'
  if (/<\\/?[a-z][\\s\\S]*>/i.test(content)) return content
  return content.split(/\\r?\\n/).map((line) => '<p>' + (escapeHtml(line) || '<br>') + '</p>').join('')
}

function safeFileName(title) {
  return (title || 'VoiceDocs document').replace(/[<>:"/\\\\|?*\\u0000-\\u001F]/g, '-').replace(/\\s+/g, ' ').trim().slice(0, 120) || 'VoiceDocs document'
}

function buildExportHtml(title, content) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title>' +
    '<style>body{font-family:Arial,sans-serif;color:#202124;font-size:11pt;line-height:1.6}h1{font-size:22pt;margin:0 0 22pt}h2{font-size:16pt;margin-top:18pt}p{margin:0 0 9pt}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px}blockquote{border-left:3px solid #94a3b8;margin-left:0;padding-left:12px;color:#475569}a{color:#1d4ed8;text-decoration:underline}</style>' +
    '</head><body><h1>' + escapeHtml(title) + '</h1>' + normalizeContent(content) + '</body></html>'
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
  const blob = await HTMLtoDOCX(buildExportHtml(title, content), null, {
    table: { row: { cantSplit: true } }, pageNumber: true, footer: true,
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeFileName(title) + '.docx'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}