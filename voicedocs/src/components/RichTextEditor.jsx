import { useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Heading1, Heading2,
  Italic, List, ListOrdered, Redo2, Strikethrough, Underline as UnderlineIcon,
  Undo2, Quote, Pilcrow, Link2, Unlink, ImagePlus, Table2, Minus,
  ArrowDown, ArrowRight, ArrowUp, ArrowLeft, Rows3, Columns3, Trash2,
} from 'lucide-react'

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function toEditorContent(value) {
  if (!value) return '<p></p>'
  // Existing VoiceDocs documents are plain text. Convert each line into a
  // paragraph; formatted documents are already stored as HTML.
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value
  return value.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`).join('')
}

const TOOL_GROUPS = [
  [
    { label: 'Paragraph', icon: Pilcrow, run: (chain) => chain.setParagraph(), active: (editor) => editor.isActive('paragraph') },
    { label: 'Heading 1', icon: Heading1, run: (chain) => chain.toggleHeading({ level: 1 }), active: (editor) => editor.isActive('heading', { level: 1 }) },
    { label: 'Heading 2', icon: Heading2, run: (chain) => chain.toggleHeading({ level: 2 }), active: (editor) => editor.isActive('heading', { level: 2 }) },
  ],
  [
    { label: 'Bold', icon: Bold, run: (chain) => chain.toggleBold(), active: (editor) => editor.isActive('bold') },
    { label: 'Italic', icon: Italic, run: (chain) => chain.toggleItalic(), active: (editor) => editor.isActive('italic') },
    { label: 'Underline', icon: UnderlineIcon, run: (chain) => chain.toggleUnderline(), active: (editor) => editor.isActive('underline') },
    { label: 'Strikethrough', icon: Strikethrough, run: (chain) => chain.toggleStrike(), active: (editor) => editor.isActive('strike') },
  ],
  [
    { label: 'Bullet list', icon: List, run: (chain) => chain.toggleBulletList(), active: (editor) => editor.isActive('bulletList') },
    { label: 'Numbered list', icon: ListOrdered, run: (chain) => chain.toggleOrderedList(), active: (editor) => editor.isActive('orderedList') },
    { label: 'Blockquote', icon: Quote, run: (chain) => chain.toggleBlockquote(), active: (editor) => editor.isActive('blockquote') },
  ],
  [
    { label: 'Align left', icon: AlignLeft, run: (chain) => chain.setTextAlign('left'), active: (editor) => editor.isActive({ textAlign: 'left' }) },
    { label: 'Align center', icon: AlignCenter, run: (chain) => chain.setTextAlign('center'), active: (editor) => editor.isActive({ textAlign: 'center' }) },
    { label: 'Align right', icon: AlignRight, run: (chain) => chain.setTextAlign('right'), active: (editor) => editor.isActive({ textAlign: 'right' }) },
    { label: 'Justify', icon: AlignJustify, run: (chain) => chain.setTextAlign('justify'), active: (editor) => editor.isActive({ textAlign: 'justify' }) },
  ],
]

export default function RichTextEditor({ value, onChange, editable = true, editorRef, placeholder = 'Start writing your document…' }) {
  const [counts, setCounts] = useState({ words: 0, characters: 0 })
  const [initialContent] = useState(() => toEditorContent(value || ''))
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, linkOnPaste: true } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        class: 'rich-text-content',
        'aria-label': 'Document content editor',
        id: 'edit-document-content',
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getHTML())
      const text = currentEditor.getText()
      setCounts({
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
        characters: text.length,
      })
    },
    onCreate: ({ editor: currentEditor }) => {
      const text = currentEditor.getText()
      setCounts({
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
        characters: text.length,
      })
    },
  })

  function addLink() {
    if (!editor) return
    const previous = editor.getAttributes('link').href || ''
    const url = window.prompt('Enter the link URL', previous)
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    let safeUrl
    try {
      safeUrl = new URL(url.trim(), window.location.origin)
      if (!['http:', 'https:', 'mailto:'].includes(safeUrl.protocol)) {
        window.alert('Please enter a valid http, https, or mailto link.')
        return
      }
    } catch {
      window.alert('Please enter a valid URL.')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: safeUrl.href }).run()
  }

  function addImage() {
    if (!editor) return
    const url = window.prompt('Enter an image URL (https://...)')
    if (!url?.trim()) return
    try {
      const imageUrl = new URL(url.trim())
      if (!['http:', 'https:'].includes(imageUrl.protocol)) throw new Error('Invalid protocol')
      editor.chain().focus().setImage({ src: imageUrl.href, alt: 'Document image' }).run()
    } catch {
      window.alert('Please enter a valid http or https image URL.')
    }
  }

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor) return
    const nextContent = toEditorContent(value || '')
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false })
      const text = editor.getText()
      setCounts({
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
        characters: text.length,
      })
    }
  }, [editor, value])

  useEffect(() => {
    if (editorRef) editorRef.current = editor
    return () => {
      if (editorRef) editorRef.current = null
    }
  }, [editor, editorRef])

  if (!editor) return <div className="rich-text-loading">Loading editor…</div>

  return (
    <div className={`rich-text-editor ${editable ? '' : 'rich-text-readonly'}`}>
      {editable && (
        <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
          {TOOL_GROUPS.map((group, groupIndex) => (
            <div className="rich-text-tool-group" key={groupIndex}>
              {group.map(({ label, icon: Icon, run, active }) => (
                <button
                  key={label}
                  type="button"
                  className={`rich-text-tool ${active(editor) ? 'active' : ''}`}
                  title={label}
                  aria-label={label}
                  aria-pressed={active(editor)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(editor.chain().focus()).run()}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          ))}
          <div className="rich-text-tool-group">
            <button type="button" className={`rich-text-tool ${editor.isActive('link') ? 'active' : ''}`} title="Insert or edit link" aria-label="Insert or edit link" onMouseDown={(event) => event.preventDefault()} onClick={addLink}><Link2 size={16} /></button>
            <button type="button" className="rich-text-tool" title="Remove link" aria-label="Remove link" disabled={!editor.isActive('link')} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}><Unlink size={16} /></button>
            <button type="button" className="rich-text-tool" title="Insert image by URL" aria-label="Insert image by URL" onMouseDown={(event) => event.preventDefault()} onClick={addImage}><ImagePlus size={16} /></button>
            <button type="button" className="rich-text-tool" title="Insert 3 × 3 table" aria-label="Insert table" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /></button>
            <button type="button" className="rich-text-tool" title="Insert horizontal divider" aria-label="Insert horizontal divider" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} /></button>
          </div>
          {editor.isActive('table') && (
            <div className="rich-text-tool-group" aria-label="Table actions">
              <button type="button" className="rich-text-tool" title="Add row above" aria-label="Add row above" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().addRowBefore().run()}><ArrowUp size={16} /></button>
              <button type="button" className="rich-text-tool" title="Add row below" aria-label="Add row below" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()}><ArrowDown size={16} /></button>
              <button type="button" className="rich-text-tool" title="Add column before" aria-label="Add column before" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().addColumnBefore().run()}><ArrowLeft size={16} /></button>
              <button type="button" className="rich-text-tool" title="Add column after" aria-label="Add column after" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()}><ArrowRight size={16} /></button>
              <button type="button" className="rich-text-tool" title="Toggle header row" aria-label="Toggle header row" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().toggleHeaderRow().run()}><Rows3 size={16} /></button>
              <button type="button" className="rich-text-tool" title="Delete current row" aria-label="Delete current row" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()}><Rows3 size={16} /></button>
              <button type="button" className="rich-text-tool" title="Delete current column" aria-label="Delete current column" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()}><Columns3 size={16} /></button>
              <button type="button" className="rich-text-tool" title="Delete table" aria-label="Delete table" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={16} /></button>
            </div>
          )}
          <div className="rich-text-tool-group history-tools">
            <button type="button" className="rich-text-tool" title="Undo" aria-label="Undo" disabled={!editor.can().undo()} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></button>
            <button type="button" className="rich-text-tool" title="Redo" aria-label="Redo" disabled={!editor.can().redo()} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
      {editable && <div className="rich-text-status"><span>{counts.words} words</span><span>{counts.characters} characters</span></div>}
    </div>
  )
}
