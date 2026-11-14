import { useEffect, useRef, useState } from 'react'
import { AudioLines, LoaderCircle, Mic, Square, Upload } from 'lucide-react'
import { transcribeUploadedAudioWithSpeechRecognition } from '../features/documents/browserTranscription'
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

export default function VoiceDictation({ onTranscript, defaultLanguage = 'en' }) {
  const [language, setLanguage] = useState(defaultLanguage || 'en')
  const [previousDefaultLanguage, setPreviousDefaultLanguage] = useState(defaultLanguage)
  const [mode, setMode] = useState('live')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [preview, setPreview] = useState('')
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
  const recognitionRestartTimerRef = useRef(null)
  const recognitionRestartCountRef = useRef(0)

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
    if (recognitionRestartTimerRef.current) clearTimeout(recognitionRestartTimerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  function currentTranscript() {
    return [finalTranscriptRef.current.trim(), interimTranscriptRef.current.trim()].filter(Boolean).join(' ').trim()
  }

  async function finishRecording(selectedMode, recorder, stream) {
    setIsRecording(false)
    stream.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    try {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const duration = Math.max(0, (Date.now() - startedAtRef.current) / 1000)
      setIsTranscribing(true)

      // Both microphone modes use the browser's Web Speech API. Keep the
      // captured audio with the draft so it can be backed up when the document is saved.
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
          filename: selectedMode === 'live' ? `live-dictation.${extension}` : `recording.${extension}`,
          mimeType,
          duration,
          language: languageRef.current,
          transcript,
        } : null)
      } else {
        setError('No speech was recognized in this recording.')
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
    setMode(selectedMode)
    modeRef.current = selectedMode
    chunksRef.current = []
    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    stoppingRef.current = false
    recognitionRestartCountRef.current = 0
    if (recognitionRestartTimerRef.current) clearTimeout(recognitionRestartTimerRef.current)

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Audio recording is not supported. Use a recent Chrome or Edge browser over HTTPS or localhost.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Live dictation is not supported in this browser. Use a recent Chrome or Edge browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      startedAtRef.current = Date.now()
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => { void finishRecording(selectedMode, recorder, stream) }

      {
        const recognition = new SpeechRecognition()
        recognition.lang = SPEECH_LOCALES[languageRef.current] || languageRef.current
        recognition.continuous = true
        recognition.interimResults = true
        recognition.onresult = (event) => {
          let interim = ''
          recognitionRestartCountRef.current = 0
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
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture' || event.error === 'language-not-supported') {
            setError(`Live dictation stopped: ${event.error}. Check microphone permission and the selected language.`)
            stoppingRef.current = true
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(`Live dictation warning: ${event.error}. Voice recognition will try to reconnect.`)
          }
        }
        recognition.onend = () => {
          if (stoppingRef.current) {
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
            return
          }
          // Chrome may end a continuous recognition session after a short interval.
          // Restart the same locale while the microphone recording is still active.
          if (recorderRef.current?.state === 'recording' && recognitionRestartCountRef.current < 8) {
            recognitionRestartCountRef.current += 1
            recognitionRestartTimerRef.current = setTimeout(() => {
              if (!stoppingRef.current && recorderRef.current?.state === 'recording') {
                try { recognition.start() } catch (restartError) {
                  setError(`Could not resume voice recognition: ${restartError.message || 'please stop and start again.'}`)
                }
              }
            }, 300)
          } else if (recorderRef.current?.state === 'recording') {
            setError('Voice recognition paused repeatedly. Stop and start dictation again; your captured audio is retained.')
            stoppingRef.current = true
            recorderRef.current.stop()
          }
        }
        recognitionRef.current = recognition
      }

      recorder.start(1000)
      setIsRecording(true)
      recognitionRef.current.start()
    } catch (requestError) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setError(requestError.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access and try again.'
        : requestError.message || 'Could not access the microphone. Check your device settings.')
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
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
    setIsTranscribing(true)
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        throw new Error('Uploaded-audio transcription is not supported in this browser. Use a recent desktop Chrome or Edge version.')
      }
      const transcript = await transcribeUploadedAudioWithSpeechRecognition(
        file,
        SpeechRecognition,
        SPEECH_LOCALES[languageRef.current] || languageRef.current,
        setPreview,
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
    }
  }


  return (
    <section className="voice-dictation" aria-label="Voice to text">
      <div className="voice-dictation-heading">
        <div><AudioLines size={18} /><strong>Voice to text</strong></div>
        <span>Web Speech API · Browser speech recognition</span>
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
            <button type="button" className="voice-action-button voice-action-secondary" onClick={() => startRecording('record')} disabled={isTranscribing}><AudioLines size={15} /> Record & transcribe</button>
            <button type="button" className="voice-action-button voice-action-secondary" onClick={() => uploadInputRef.current?.click()} disabled={isTranscribing}><Upload size={15} /> Upload audio</button>
            <input ref={uploadInputRef} className="voice-file-input" type="file" accept="audio/*,.webm,.wav,.mp3,.m4a,.mp4,.ogg,.aac,.flac" onChange={handleAudioUpload} disabled={isTranscribing} aria-label="Choose an audio file to transcribe" />
          </div>
        ) : (
          <button type="button" className="voice-action-button voice-stop-button" onClick={stopRecording}><Square size={14} /> Stop recording</button>
        )}
      </div>
      <p className="voice-provider-note">Live dictation, recordings, and uploaded audio use Chrome’s native Web Speech API. It recognizes one selected language at a time; for Marathi–Hindi–English code-switching, choose the language spoken most often and switch the document language between separate sections. Clear audio and a quiet room also help.</p>
      {(isRecording || isTranscribing || preview) && (
        <div className="voice-transcript-preview" aria-live="polite">
          <div className="voice-preview-meta">
            <span>{isRecording ? (mode === 'live' ? 'Listening · live preview' : 'Recording audio') : isTranscribing ? 'Transcribing audio…' : 'Transcript ready'}</span>
          </div>
          {isTranscribing && <div className="voice-processing-indicator"><LoaderCircle className="spin-icon" size={18} /><span>Playing audio into browser speech recognition…</span></div>}
          <p>{preview || (isRecording ? 'Speak clearly. Your transcript will appear here…' : 'Preparing transcript…')}</p>
          {mode === 'live' && isRecording && <small>Speak naturally. Your transcript and audio stay in this draft until you save the document.</small>}
        </div>
      )}
      {error && <p className="voice-error" role="alert">{error}</p>}
    </section>
  )
}
