import { useEffect, useRef, useState } from 'react'
import { AudioLines, Mic, Square, Upload } from 'lucide-react'
import { transcribeAudio } from '../features/documents/documentsApi'
import { uploadBrowserRecording } from '../features/recordings/recordingsApi'
import { SUPPORTED_LANGUAGES } from '../features/current-user/languages'

const SPEECH_LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', ta: 'ta-IN', te: 'te-IN', ur: 'ur-PK' }

function getErrorMessage(requestError) {
  const detail = requestError?.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || String(item)).join('; ')
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') return detail.msg || detail.message || 'The server rejected the audio upload.'
  return requestError?.message || 'Could not process this audio. Please try again.'
}

export default function VoiceDictation({ onTranscript, defaultLanguage = 'en', transcriptionProvider = 'whisper' }) {
  const [language, setLanguage] = useState(defaultLanguage)
  const [mode, setMode] = useState('live')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [preview, setPreview] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('')
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const uploadInputRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const finalTranscriptRef = useRef('')
  const interimTranscriptRef = useRef('')
  const startedAtRef = useRef(0)
  const stoppingRef = useRef(false)
  const languageRef = useRef(language)
  const modeRef = useRef(mode)

  useEffect(() => { setLanguage(defaultLanguage || 'en') }, [defaultLanguage])
  useEffect(() => { languageRef.current = language }, [language])
  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => () => {
    stoppingRef.current = true
    try { recognitionRef.current?.abort() } catch { /* browser may already have stopped */ }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  function currentTranscript() {
    return [finalTranscriptRef.current.trim(), interimTranscriptRef.current.trim()].filter(Boolean).join(' ').trim()
  }

  async function transcribeBlob(blob, filename) {
    const formData = new FormData()
    formData.append('file', blob, filename)
    const result = await transcribeAudio(formData, languageRef.current)
    setDetectedLanguage(result.language || '')
    setPreview(result.text || '')
    return result.text || ''
  }

  async function finishRecording(selectedMode, recorder, stream) {
    setIsRecording(false)
    stream.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    try {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      if (!blob.size) throw new Error('No audio was captured.')
      const duration = Math.max(0, (Date.now() - startedAtRef.current) / 1000)
      setIsTranscribing(true)
      if (selectedMode === 'live') {
        const transcript = finalTranscriptRef.current.trim()
        if (!transcript) throw new Error('No speech was recognized. Check your microphone and selected language, then try again.')
        const formData = new FormData()
        formData.append('file', blob, 'live-dictation.webm')
        formData.append('transcript', transcript)
        const saved = await uploadBrowserRecording(formData, { duration, language: languageRef.current })
        if (!saved?.saved) throw new Error('The transcript was captured, but the audio could not be saved to Google Drive. Connect Google Drive and try again.')
        setPreview(transcript)
        onTranscript(transcript)
      } else {
        const transcript = await transcribeBlob(blob, 'recording.webm')
        if (transcript) onTranscript(transcript)
        else setError('No speech was detected in this recording.')
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsTranscribing(false)
      recorderRef.current = null
      recognitionRef.current = null
    }
  }

  async function startRecording(selectedMode) {
    setError('')
    setPreview('')
    setDetectedLanguage('')
    setMode(selectedMode)
    modeRef.current = selectedMode
    chunksRef.current = []
    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    stoppingRef.current = false

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Audio recording is not supported. Use a recent Chrome or Edge browser over HTTPS or localhost.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (selectedMode === 'live' && !SpeechRecognition) {
      setError('Live dictation is not supported in this browser. Use a recent Chrome or Edge browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startedAtRef.current = Date.now()
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => { void finishRecording(selectedMode, recorder, stream) }

      if (selectedMode === 'live') {
        const recognition = new SpeechRecognition()
        recognition.lang = SPEECH_LOCALES[languageRef.current] || languageRef.current
        recognition.continuous = true
        recognition.interimResults = true
        recognition.onresult = (event) => {
          let interim = ''
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const phrase = event.results[index][0]?.transcript || ''
            if (event.results[index].isFinal) finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + phrase.trim()
            else interim += phrase
          }
          interimTranscriptRef.current = interim
          setPreview(currentTranscript())
        }
        recognition.onerror = (event) => {
          if (event.error !== 'no-speech' && event.error !== 'aborted') setError(`Live dictation error: ${event.error}. Check microphone permission and try again.`)
        }
        recognition.onend = () => {
          if (stoppingRef.current && recorderRef.current?.state === 'recording') recorderRef.current.stop()
        }
        recognitionRef.current = recognition
      }

      recorder.start(1000)
      setIsRecording(true)
      if (selectedMode === 'live') recognitionRef.current.start()
    } catch (requestError) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setError(requestError.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access and try again.'
        : requestError.message || 'Could not access the microphone. Check your device settings.')
    }
  }

  function stopRecording() {
    if (modeRef.current === 'live' && recognitionRef.current) {
      stoppingRef.current = true
      try { recognitionRef.current.stop() } catch { /* onend will finalize if already stopped */ }
      return
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  async function handleAudioUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
      setError('Audio files must be 25 MB or smaller.')
      return
    }
    setError('')
    setPreview('')
    setDetectedLanguage('')
    setIsTranscribing(true)
    try {
      const transcript = await transcribeBlob(file, file.name)
      if (transcript) onTranscript(transcript)
      else setError('No speech was detected in this audio file.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsTranscribing(false)
    }
  }

  const languageOptions = transcriptionProvider === 'indicconformer'
    ? SUPPORTED_LANGUAGES.filter((item) => ['hi', 'mr'].includes(item.value))
    : SUPPORTED_LANGUAGES

  return (
    <section className="voice-dictation" aria-label="Voice to text">
      <div className="voice-dictation-heading">
        <div><AudioLines size={18} /><strong>Voice to text</strong></div>
        <span>{transcriptionProvider === 'indicconformer' ? 'IndicConformer · Hindi and Marathi' : 'Whisper · Server transcription'}</span>
      </div>
      <div className="voice-dictation-controls">
        <label className="voice-language-field">
          <span>Document language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isRecording || isTranscribing}>
            {languageOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {!isRecording ? (
          <div className="voice-start-actions">
            <button type="button" className="voice-action-button" onClick={() => startRecording('live')} disabled={isTranscribing}><Mic size={15} /> Live dictation</button>
            <button type="button" className="voice-action-button voice-action-secondary" onClick={() => startRecording('record')} disabled={isTranscribing}><AudioLines size={15} /> Record & transcribe</button>
            <button type="button" className="voice-action-button voice-action-secondary" onClick={() => uploadInputRef.current?.click()} disabled={isTranscribing}><Upload size={15} /> Upload audio</button>
            <input ref={uploadInputRef} className="voice-file-input" type="file" accept="audio/*,.webm,.wav,.mp3,.m4a,.mp4,.ogg,.aac,.flac" onChange={handleAudioUpload} disabled={isTranscribing} aria-label="Choose an audio file to transcribe" />
          </div>
        ) : (
          <button type="button" className="voice-action-button voice-stop-button" onClick={stopRecording}><Square size={14} /> Stop recording</button>
        )}
      </div>
      {transcriptionProvider === 'indicconformer' && <p className="voice-provider-note">This server uses IndicConformer. Select Hindi or Marathi for backend transcription and upload.</p>}
      {(isRecording || isTranscribing || preview) && (
        <div className="voice-transcript-preview" aria-live="polite">
          <div className="voice-preview-meta">
            <span>{isRecording ? (mode === 'live' ? 'Listening · live preview' : 'Recording audio') : isTranscribing ? 'Transcribing / saving audio…' : 'Transcript ready'}</span>
            {detectedLanguage && <span>Detected: {detectedLanguage.toUpperCase()}</span>}
          </div>
          <p>{preview || (isRecording ? 'Speak clearly. Recognized words will appear here…' : 'Preparing transcript…')}</p>
          {mode === 'live' && isRecording && <small>Live words appear in this preview. The completed transcript is inserted into your document after you stop. The original audio is saved to Google Drive.</small>}
        </div>
      )}
      {error && <p className="voice-error" role="alert">{error}</p>}
    </section>
  )
}
