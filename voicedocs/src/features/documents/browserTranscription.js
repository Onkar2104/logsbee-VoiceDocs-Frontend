function getCaptureStream(audio) {
  if (typeof audio.captureStream === 'function') return audio.captureStream()
  if (typeof audio.mozCaptureStream === 'function') return audio.mozCaptureStream()
  throw new Error('This browser cannot capture an audio track from uploaded files. Use a current desktop Chrome or Edge browser.')
}

/**
 * Transcribe an uploaded audio file using the native Web Speech API.
 * The file is played by an HTMLAudioElement and its captured audio track is
 * supplied directly to SpeechRecognition.start(audioTrack).
 */
export function transcribeUploadedAudioWithSpeechRecognition(file, SpeechRecognition, language, onTranscript = () => {}) {
  if (!file) return Promise.reject(new Error('Choose an audio file first.'))
  if (!SpeechRecognition) return Promise.reject(new Error('Speech recognition is not available in this browser.'))

  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const objectUrl = URL.createObjectURL(file)
    const recognition = new SpeechRecognition()
    let stream
    let audioTrack
    let settled = false
    let finalText = ''

    audio.preload = 'auto'
    audio.src = objectUrl
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true

    const cleanup = () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      stream?.getTracks().forEach((track) => track.stop())
      URL.revokeObjectURL(objectUrl)
    }

    const finish = (error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(finalText.trim())
    }

    recognition.onresult = (event) => {
      const phrases = []
      let interim = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const phrase = event.results[index][0]?.transcript || ''
        if (event.results[index].isFinal) phrases.push(phrase.trim())
        else interim += phrase
      }
      finalText = phrases.filter(Boolean).join(' ')
      onTranscript([finalText, interim.trim()].filter(Boolean).join(' ').trim())
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        finish(new Error(`Browser speech recognition failed: ${event.error}. Check browser support and the selected language.`))
      }
    }

    recognition.onend = () => {
      if (settled) return
      if (audio.ended) {
        finish()
        return
      }
      try {
        if (audioTrack?.readyState === 'live') recognition.start(audioTrack)
        else finish(new Error('The uploaded audio track ended before transcription completed.'))
      } catch (error) {
        finish(error)
      }
    }

    audio.onerror = () => finish(new Error('The selected audio file could not be played by this browser.'))
    audio.onended = () => {
      try { recognition.stop() } catch { finish() }
    }

    audio.oncanplay = async () => {
      audio.oncanplay = null
      try {
        stream = getCaptureStream(audio)
        audioTrack = stream.getAudioTracks()[0]
        if (!audioTrack || audioTrack.readyState !== 'live') {
          throw new Error('Could not create a live audio track from this file.')
        }
        await audio.play()
        recognition.start(audioTrack)
      } catch (error) {
        finish(error)
      }
    }

    audio.load()
  })
}
