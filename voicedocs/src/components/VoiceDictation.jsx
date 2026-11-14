import { useEffect, useRef, useState } from 'react'
import { AudioLines, LoaderCircle, Mic, Square, Upload } from 'lucide-react'
import { transcribeAudio } from '../features/documents/documentsApi'
import { transcribeUploadedAudioInBrowser } from '../features/documents/browserTranscription'
import { SUPPORTED_LANGUAGES } from '../features/current-user/languages'

const SPEECH_LOCALES = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN',
  kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', ta: 'ta-IN', te: 'te-IN',
  ur: 'ur-PK', as: 'as-IN', or: 'or-IN', ne: 'ne-NP', sa: 'sa-IN',
  ar: 'ar-SA', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it-IT',
  ja: 'ja-JP', ko: 'ko-KR', pt: 'pt-BR', ru: 'ru-RU', zh: 'zh-CN',
  tr: 'tr-TR', vi: 'vi-VN', th: 'th-TH', id: 'id-ID', nl: 'nl-NL',
  pl: 'pl-PL', uk: 'uk-UA', sw: 'sw-KE',
}

function getErrorMessage(requestError) {
  const detail = requestError?.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || String(item)).join('; ')
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') return detail.msg || detail.message || 'The server rejected the audio upload.'
  return requestError?.message || 'Could not process this audio. Please try again.'
}

export default function VoiceDictation({ onTranscript, defaultLanguage = 'en', transcriptionProvider = 'whisper' }) {
  const [language, setLanguage] = useState(defaultLanguage || 'en')
  const [previousDefaultLanguage, setPreviousDefaultLanguage] = useState(defaultLanguage)
  const [mode, setMode] = useState('live')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [preview, setPreview] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('')
  const [modelProgress, setModelProgress] = useState('')
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

  // React's conditional render-time state adjustment keeps a changed account default
  // in sync without scheduling a cascading update from an effect.
  if (defaultLanguage !== previousDefaultLanguage) {
    setPreviousDefaultLanguage(defaultLanguage)
    setLanguage(defaultLanguage || 'en')
  }
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
    // The backend selects Whisper or IndicConformer from TRANSCRIPTION_PROVIDER in its .env.
    // Do not send a provider override from the browser.
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
      const duration = Math.max(0, (Date.now() - startedAtRef.current) / 1000)
      setIsTranscribing(true)

      if (selectedMode === 'live') {
        // Keep the original recording in browser memory. The document page uploads it
        // to Drive only after the user explicitly saves or creates the document.
        const transcript = finalTranscriptRef.current.trim()
        setPreview(transcript)
        if (transcript) {
          const mimeType = recorder.mimeType || blob.type || 'audio/webm'
          const extension = mimeType.includes('ogg') ? 'ogg'
            : mimeType.includes('mp4') ? 'm4a'
              : mimeType.includes('wav') ? 'wav'
                : 'webm'
          onTranscript(transcript, blob.size ? {
            blob,
            filename: `live-dictation.${extension}`,
            mimeType,
            duration,
            language: languageRef.current,
            transcript,
          } : null)
        } else {
          setError('No speech was recognized. No audio will be saved unless you create a document.')
        }
      } else {
        if (!blob.size) throw new Error('No audio was captured.')
        const mimeType = recorder.mimeType || blob.type || 'audio/webm'
        const extension = mimeType.includes('ogg') ? 'ogg'
          : mimeType.includes('mp4') ? 'm4a'
            : mimeType.includes('wav') ? 'wav'
              : 'webm'
        const transcript = await transcribeBlob(blob, `recording.${extension}`)
        if (transcript) onTranscript(transcript, {
          blob,
          filename: `recording.${extension}`,
          mimeType,
          duration,
          language: languageRef.current,
          transcript,
        })
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

    if (selectedMode !== 'live' && transcriptionProvider === 'indicconformer' && !['hi', 'mr'].includes(languageRef.current)) {
      setError('The backend is configured for IndicConformer, which supports Hindi and Marathi only. Change the document language to Hindi or Marathi, or use Live dictation.')
      return
    }

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
            if (event.results[index].isFinal) {
              finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + phrase.trim()
            } else {
              interim += phrase
            }
          }
          interimTranscriptRef.current = interim
          setPreview(currentTranscript())
        }
        recognition.onerror = (event) => {
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(`Live dictation error: ${event.error}. Check microphone permission and try again.`)
          }
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
    setModelProgress('')
    setIsTranscribing(true)
    try {
      const transcript = await transcribeUploadedAudioInBrowser(
        file,
        languageRef.current,
        (progress) => {
          if (progress?.status === 'progress' && progress.file) {
            setModelProgress(`Downloading ${progress.file}… ${Math.round(progress.progress || 0)}%`)
          } else if (progress?.status === 'initiate') {
            setModelProgress('Preparing the browser transcription model…')
          } else if (progress?.status === 'done') {
            setModelProgress('Model ready. Transcribing audio on this device…')
          }
        },
      )
      setPreview(transcript)
      if (transcript) onTranscript(transcript, {
        blob: file,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        duration: null,
        language: languageRef.current,
        transcript,
      })
      else setError('No speech was detected in this audio file.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsTranscribing(false)
      setModelProgress('')
    }
  }

  const indicLanguageUnsupported = transcriptionProvider === 'indicconformer' && !['hi', 'mr'].includes(language)

  return (
    <section className="voice-dictation" aria-label="Voice to text">
      <div className="voice-dictation-heading">
        <div><AudioLines size={18} /><strong>Voice to text</strong></div>
        <span>Browser Whisper · On-device upload transcription</span>
      </div>
      <div className="voice-dictation-controls">
        <label className="voice-language-field">
          <span>Document language</span>
          <select value={language} onChange={(event) => { languageRef.current = event.target.value; setLanguage(event.target.value) }} disabled={isRecording || isTranscribing}>
            {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {!isRecording ? (
          <div className="voice-start-actions">
            <button type="button" className="voice-action-button" onClick={() => startRecording('live')} disabled={isTranscribing}><Mic size={15} /> Live dictation</button>
            <button type="button" className="voice-action-button voice-action-secondary" onClick={() => startRecording('record')} disabled={isTranscribing || indicLanguageUnsupported}><AudioLines size={15} /> Record & transcribe</button>
            <button type="button" className="voice-action-button voice-action-secondary" onClick={() => uploadInputRef.current?.click()} disabled={isTranscribing}><Upload size={15} /> Upload audio</button>
            <input ref={uploadInputRef} className="voice-file-input" type="file" accept="audio/*,.webm,.wav,.mp3,.m4a,.mp4,.ogg,.aac,.flac" onChange={handleAudioUpload} disabled={isTranscribing || indicLanguageUnsupported} aria-label="Choose an audio file to transcribe" />
          </div>
        ) : (
          <button type="button" className="voice-action-button voice-stop-button" onClick={stopRecording}><Square size={14} /> Stop recording</button>
        )}
      </div>
      <p className="voice-provider-note">Uploaded audio is transcribed locally in your browser with Whisper. The first use downloads the model; performance depends on your device.</p>
      {transcriptionProvider === 'indicconformer' && (
        <p className="voice-provider-note">
          Record &amp; transcribe uses the configured server provider. Upload audio always uses browser-based Whisper and does not send the audio file to the VoiceDocs transcription API.
        </p>
      )}
      {(isRecording || isTranscribing || preview) && (
        <div className="voice-transcript-preview" aria-live="polite">
          <div className="voice-preview-meta">
            <span>{isRecording ? (mode === 'live' ? 'Listening · live preview' : 'Recording audio') : isTranscribing ? 'Transcribing / saving audio…' : 'Transcript ready'}</span>
            {detectedLanguage && <span>Detected: {detectedLanguage.toUpperCase()}</span>}
          </div>
          {isTranscribing && <div className="voice-processing-indicator"><LoaderCircle className="spin-icon" size={18} /><span>{modelProgress || 'Processing audio and generating the transcript on this device…'}</span></div>}
          <p>{preview || (isRecording ? 'Speak clearly. Your transcript will appear here…' : 'Preparing transcript…')}</p>
          {mode === 'live' && isRecording && <small>Speak naturally. Your transcript and audio stay in this draft until you save the document.</small>}
        </div>
      )}
      {error && <p className="voice-error" role="alert">{error}</p>}
    </section>
  )
}
