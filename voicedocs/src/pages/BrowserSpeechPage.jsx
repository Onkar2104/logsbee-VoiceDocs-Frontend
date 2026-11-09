import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Mic, MicOff, Save, Square, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { uploadBrowserRecording } from '../features/recordings/recordingsApi'
import './BrowserSpeechPage.css'

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
]

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export default function BrowserSpeechPage() {
  const [language, setLanguage] = useState('en-US')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [driveSaved, setDriveSaved] = useState(false)
  const recognitionRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const transcriptRef = useRef('')
  const startedAtRef = useRef(0)
  const shouldUploadRef = useRef(false)

  useEffect(() => () => {
    shouldUploadRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onerror = null
      recognitionRef.current.onend = null
      try { recognitionRef.current.stop() } catch { /* already stopped */ }
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  function updateTranscript(value) {
    transcriptRef.current = value
    setTranscript(value)
  }

  async function startRecording() {
    setError('')
    setMessage('')
    setDriveSaved(false)
    updateTranscript('')
    setInterim('')
    chunksRef.current = []

    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setError('Speech recognition is unavailable. Try the latest Google Chrome or Microsoft Edge.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('This browser does not support microphone audio recording.')
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
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (!shouldUploadRef.current) return
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (!blob.size) {
          setError('No audio data was captured. Please record again.')
          setStatus('idle')
          return
        }
        const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm'
        const formData = new FormData()
        formData.append('file', blob, 'browser-recording-' + Date.now() + '.' + extension)
        formData.append('transcript', transcriptRef.current)
        setIsSaving(true)
        setStatus('saving')
        setMessage('Uploading audio to your connected Google Drive…')
        try {
          await uploadBrowserRecording(formData, {
            duration: Math.max(0, (Date.now() - startedAtRef.current) / 1000),
            language,
          })
          setDriveSaved(true)
          setMessage('Recording saved to Google Drive. The transcript is stored with its VoiceDocs recording.')
        } catch (uploadError) {
          setError(uploadError.response?.data?.detail || 'Could not save the recording. Check your Google Drive connection.')
          setMessage('')
        } finally {
          setIsSaving(false)
          setStatus('idle')
          shouldUploadRef.current = false
        }
      }

      const recognition = new Recognition()
      recognitionRef.current = recognition
      recognition.lang = language
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        let finalText = transcriptRef.current
        let interimText = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          const text = result[0]?.transcript || ''
          if (result.isFinal) finalText += text + ' '
          else interimText += text
        }
        updateTranscript(finalText)
        setInterim(interimText)
      }
      recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError('Speech recognition error: ' + event.error + '. You can still stop and save the audio.')
        }
      }
      recognition.onend = () => {
        if (recorderRef.current?.state === 'recording' && shouldUploadRef.current) {
          try { recognition.start() } catch { /* browser may already be restarting */ }
        }
      }

      startedAtRef.current = Date.now()
      shouldUploadRef.current = true
      recorder.start(1000)
      recognition.start()
      setStatus('recording')
      setMessage('Listening… speak naturally. Audio is being recorded in this tab.')
    } catch (startError) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStatus('idle')
      setError(startError.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access and try again.'
        : startError.message || 'Could not start microphone recording.')
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      try { recognitionRef.current.stop() } catch { /* already stopped */ }
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    } else {
      setStatus('idle')
    }
    setInterim('')
    setMessage('Finishing recording…')
  }

  const isRecording = status === 'recording'
  const speechSupported = Boolean(getSpeechRecognition())

  return (
    <main className="browser-speech-shell">
      <header className="browser-speech-header">
        <Link className="browser-speech-back" to="/"><ArrowLeft size={17} /> Workspace</Link>
        <span className="browser-speech-brand"><span className="brand-mark brand-mark-small">V</span> VoiceDocs</span>
      </header>
      <section className="browser-speech-content">
        <div className="browser-speech-heading">
          <p className="eyebrow">BROWSER SPEECH RECOGNITION</p>
          <h1>Speak. See your words.</h1>
          <p>Transcribe speech in your browser, back up the original audio to Google Drive, and keep the transcript with its VoiceDocs recording.</p>
        </div>
        <section className="browser-speech-card">
          <div className="browser-speech-controls">
            <label htmlFor="speech-language">Recognition language</label>
            <select id="speech-language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isRecording || isSaving}>
              {LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {!isRecording ? (
              <button className="browser-speech-start" type="button" onClick={() => void startRecording()} disabled={isSaving}>
                <Mic size={18} /> {isSaving ? 'Saving…' : 'Start recording'}
              </button>
            ) : (
              <button className="browser-speech-stop" type="button" onClick={stopRecording}>
                <Square size={16} /> Stop & save
              </button>
            )}
          </div>
          <div className={'browser-speech-status ' + (isRecording ? 'is-live' : '')}>
            {isRecording ? <span className="browser-speech-pulse" /> : <Volume2 size={16} />}
            <span>{isRecording ? 'Recording and listening' : status === 'saving' ? 'Saving to Google Drive' : 'Ready to record'}</span>
          </div>
          <div className="browser-speech-transcript">
            <div className="browser-speech-transcript-heading">
              <h2>Live transcript</h2>
              <span>{transcript.trim() ? transcript.trim().split(/\s+/).length + ' words' : 'No speech yet'}</span>
            </div>
            <p>{transcript || (isRecording ? 'Start speaking…' : 'Your recognized words will appear here.')}{interim && <span className="browser-speech-interim"> {interim}</span>}</p>
          </div>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {message && <p className={'browser-speech-message ' + (driveSaved ? 'is-success' : '')} role="status">{message}</p>}
          {!speechSupported && <p className="browser-speech-note"><MicOff size={15} /> Web Speech API is not available in this browser. Use a recent Chrome or Edge browser.</p>}
          <p className="browser-speech-note"><Save size={15} /> Stopping uploads the original audio to Drive and stores the recognized transcript with the recording. Connect Google Drive first from the workspace.</p>
        </section>
      </section>
    </main>
  )
}
