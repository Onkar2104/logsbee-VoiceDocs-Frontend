import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Heading1, Heading2,
  Italic, List, ListOrdered, Redo2, Strikethrough, Underline as UnderlineIcon,
  Undo2, Quote, Pilcrow,
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
  const initialContent = useMemo(() => toEditorContent(value || ''), [])
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        class: 'rich-text-content',
        'aria-label': 'Document content editor',
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

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

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
