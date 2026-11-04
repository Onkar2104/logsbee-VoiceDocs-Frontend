import { useEffect, useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Heading1, Heading2,
  Italic, List, ListOrdered, Redo2, Strikethrough, Underline as UnderlineIcon,
  Undo2, Quote, Pilcrow, Link2, Unlink, ImagePlus,
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

const UploadedImage = Node.create({
  name: 'image',
  group: 'block',
  draggable: true,
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { class: 'rich-text-image', loading: 'lazy' })]
  },
})

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
  const [initialContent] = useState(() => toEditorContent(value || ''))
  const imageInputRef = useRef(null)
  function handleImageSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !editor) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      window.alert('Please choose a JPG, PNG, or WebP image.')
      return
    }
    const maxSizeBytes = 1024 * 1024
    if (file.size > maxSizeBytes) {
      window.alert('Please choose an image smaller than 1 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        window.alert('Could not read this image. Please try another file.')
        return
      }
      editor.chain().focus().insertContent({
        type: 'image',
        attrs: { src: reader.result, alt: file.name.replace(/\\.[^.]+$/, ''), title: file.name },
      }).run()
    }
    reader.onerror = () => window.alert('Could not read this image. Please try another file.')
    reader.readAsDataURL(file)
  }

  function handleSetLink() {
    if (!editor) return
    const currentHref = editor.getAttributes('link').href || ''
    const enteredUrl = window.prompt('Enter a link URL (https:// or mailto:)', currentHref)
    if (enteredUrl === null) return
    const rawUrl = enteredUrl.trim()
    if (!rawUrl) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    const safeUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('mailto:')) ? rawUrl : 'https://' + rawUrl
    try {
      const parsed = new URL(safeUrl)
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) throw new Error('Unsupported URL protocol')
      editor.chain().focus().extendMarkRange('link').setLink({ href: parsed.href, target: '_blank', rel: 'noopener noreferrer nofollow' }).run()
    } catch { window.alert('Please enter a valid web address or email link.') }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } }),
      UploadedImage,
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
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor) return
    const nextContent = toEditorContent(value || '')
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (editorRef) editorRef.current = editor
    return () => {
      if (editorRef) editorRef.current = null
    }
  }, [editor, editorRef])

  if (!editor) return <div className="rich-text-loading">Loading editor…</div>

  const counts = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const text = currentEditor?.getText() || ''
      return {
        words: text.trim() ? text.trim().split(/\\s+/).length : 0,
        characters: text.length,
      }
    },
  })

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
            <button type="button" className="rich-text-tool" title="Upload image" aria-label="Upload image" onMouseDown={(event) => event.preventDefault()} onClick={() => imageInputRef.current?.click()}><ImagePlus size={16} /></button>
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImageSelected} />
          </div>
          <div className="rich-text-tool-group">
            <button type="button" className={`rich-text-tool ${editor.isActive('link') ? 'active' : ''}`} title="Insert or edit link" aria-label="Insert or edit link" onMouseDown={(event) => event.preventDefault()} onClick={handleSetLink}><Link2 size={16} /></button>
            <button type="button" className="rich-text-tool" title="Remove link" aria-label="Remove link" disabled={!editor.isActive('link')} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}><Unlink size={16} /></button>
          </div>
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
