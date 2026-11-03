import { useEffect, useRef, useState } from 'react'
import { AudioLines, Mic, Square } from 'lucide-react'
import { transcribeAudio } from '../features/documents/documentsApi'

const LANGUAGES = [
  { value: '', label: 'Auto-detect language' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ur', label: 'Urdu' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'zh', label: 'Chinese' },
]

function getErrorMessage(requestError) {
  const detail = requestError?.response?.data?.detail

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        const location = Array.isArray(item?.loc) ? item.loc.join(' → ') : ''
        return [location, item?.msg].filter(Boolean).join(': ')
      })
      .filter(Boolean)
      .join('; ') || 'The server rejected the audio upload.'
  }

  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || 'The server rejected the audio upload.'
  }

  return requestError?.message || 'Could not transcribe this recording. Please try again.'
}

export default function VoiceDictation({ onTranscript }) {
  const [language, setLanguage] = useState('')
  const [mode, setMode] = useState('live')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [preview, setPreview] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('')
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const languageRef = useRef(language)
  const modeRef = useRef(mode)

  useEffect(() => { languageRef.current = language }, [language])
  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function transcribeBlob(blob, filename = 'recording.webm') {
    const formData = new FormData()
    formData.append('file', blob, filename)
    const result = await transcribeAudio(formData, languageRef.current)
    setDetectedLanguage(result.language || '')
    setPreview(result.text || '')
    return result.text || ''
  }


  async function startRecording(selectedMode) {
    setError('')
    setPreview('')
    setDetectedLanguage('')
    setMode(selectedMode)
    modeRef.current = selectedMode
    chunksRef.current = []
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Audio recording is not supported in this browser. Use a recent Chrome or Edge browser over HTTPS or localhost.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        setIsRecording(false)
        stream.getTracks().forEach((track) => track.stop())
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          if (!blob.size) throw new Error('No audio was captured.')
          setIsTranscribing(true)
          const transcript = await transcribeBlob(blob)
          if (transcript) onTranscript(transcript)
        } catch (requestError) {
          setError(getErrorMessage(requestError))
        } finally {
          setIsTranscribing(false)
          streamRef.current = null
          recorderRef.current = null
        }
      }
      recorder.start(1000)
      setIsRecording(true)
    } catch (requestError) {
      setError(requestError.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access and try again.'
        : 'Could not access the microphone. Check your device settings.')
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  return (
    <section className="voice-dictation" aria-label="Voice to text">
      <div className="voice-dictation-heading">
        <div><AudioLines size={18} /><strong>Voice to text</strong></div>
        <span>Whisper · Runs on your VoiceDocs server</span>
      </div>
      <div className="voice-dictation-controls">
        <label className="voice-language-field">
          <span>Language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isRecording || isTranscribing}>
            {LANGUAGES.map((item) => <option key={item.value || 'auto'} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {!isRecording ? (
          <div className="voice-start-actions">
            <button type="button" className="voice-action-button" onClick={() => startRecording('live')} disabled={isTranscribing}>
              <Mic size={15} /> Live dictation
            </button>
            <button type="button" className="voice-action-button voice-action-secondary" onClick={() => startRecording('record')} disabled={isTranscribing}>
              <AudioLines size={15} /> Record & transcribe
            </button>
          </div>
        ) : (
          <button type="button" className="voice-action-button voice-stop-button" onClick={stopRecording}>
            <Square size={14} /> Stop recording
          </button>
        )}
      </div>
      {(isRecording || isTranscribing || preview) && (
        <div className="voice-transcript-preview" aria-live="polite">
          <div className="voice-preview-meta">
            <span>{isRecording ? (mode === 'live' ? 'Listening · live dictation' : 'Recording audio') : isTranscribing ? 'Transcribing audio…' : 'Transcript ready'}</span>
            {detectedLanguage && <span>Detected: {detectedLanguage.toUpperCase()}</span>}
          </div>
          <p>{preview || (isRecording ? 'Speak clearly. Your transcript will appear here…' : 'Preparing transcript…')}</p>
          {mode === 'live' && isRecording && <small>Speak naturally. Whisper will transcribe the complete recording when you stop.</small>}
        </div>
      )}
      {error && <p className="voice-error" role="alert">{error}</p>}
    </section>
  )
}
