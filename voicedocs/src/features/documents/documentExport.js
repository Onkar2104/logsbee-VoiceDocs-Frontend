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

function sanitizePrintHtml(content) {
  const parsed = new DOMParser().parseFromString(normalizeContent(content), 'text/html')
  parsed.querySelectorAll('script,style,iframe,object,embed,svg,math,form,input,button,textarea,select').forEach((node) => node.remove())
  parsed.body.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on') || name === 'srcdoc') element.removeAttribute(attribute.name)
      if (name === 'href' && !/^(https?:|mailto:|#)/i.test(value)) element.removeAttribute(attribute.name)
      if (name === 'src' && !/^(https?:|data:image\/(png|jpeg|webp);base64,)/i.test(value)) element.removeAttribute(attribute.name)
    })
  })
  return parsed.body.innerHTML
}

export async function downloadDocumentPdf(title, content) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('The print window was blocked. Allow pop-ups for VoiceDocs and try again.')
  const safeTitle = escapeHtml(title || 'VoiceDocs document')
  const body = sanitizePrintHtml(content)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title>
<style>
@page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}html,body{background:#fff;color:#202124}
body{font-family:Arial,"Noto Sans Devanagari","Nirmala UI",sans-serif;font-size:11pt;line-height:1.55;overflow-wrap:anywhere}
h1{font-size:22pt;margin:0 0 22pt}h2{font-size:16pt;margin:18pt 0 9pt}h3,h4,h5,h6{margin:14pt 0 7pt}p{margin:0 0 9pt}
ul,ol{padding-left:28px;margin:8pt 0 14pt}li{display:list-item;margin:3pt 0}img{max-width:100%;height:auto}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px}
blockquote{border-left:3px solid #94a3b8;margin:10pt 0;padding-left:12px;color:#475569}a{color:#1d4ed8;text-decoration:underline}
tr,img,blockquote{break-inside:avoid}
</style></head><body><h1>${safeTitle}</h1>${body}
<script>window.addEventListener('load',()=>{const imgs=[...document.images];Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))).then(()=>setTimeout(()=>{window.focus();window.print()},300))})</script>
</body></html>`
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

export function downloadBlobFile(blob, title) {
  if (!(blob instanceof Blob) || blob.size < 100) throw new Error('The Word document could not be generated correctly.')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeFileName(title).toLowerCase().endsWith('.docx') ? safeFileName(title) : safeFileName(title) + '.docx'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  window.setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url) }, 60000)
}
