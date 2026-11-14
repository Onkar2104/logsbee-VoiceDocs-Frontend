const MODEL_ID = 'onnx-community/whisper-tiny'
const TARGET_SAMPLE_RATE = 16000

let transcriberPromise

const WHISPER_LANGUAGES = {
  en: 'english', hi: 'hindi', mr: 'marathi', bn: 'bengali',
  gu: 'gujarati', kn: 'kannada', ml: 'malayalam', pa: 'punjabi',
  ta: 'tamil', te: 'telugu', ur: 'urdu', as: 'assamese',
  or: 'odia', ne: 'nepali', sa: 'sanskrit', ar: 'arabic',
  fr: 'french', de: 'german', es: 'spanish', it: 'italian',
  ja: 'japanese', ko: 'korean', pt: 'portuguese', ru: 'russian',
  zh: 'chinese', tr: 'turkish', vi: 'vietnamese', th: 'thai',
  id: 'indonesian', nl: 'dutch', pl: 'polish', uk: 'ukrainian',
  sw: 'swahili',
}

async function getTranscriber(onProgress) {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      // Load Transformers.js only when an uploaded file needs transcription.
      // @vite-ignore keeps Vite from trying to bundle this browser-side CDN module.
      const { pipeline, env } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1')
      env.allowLocalModels = false
      return pipeline('automatic-speech-recognition', MODEL_ID, {
        progress_callback: onProgress,
      })
    })().catch((error) => {
      transcriberPromise = null
      throw error
    })
  }
  return transcriberPromise
}

async function decodeAudioFile(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('This browser does not support local audio processing. Try the latest Chrome or Edge.')
  }

  const context = new AudioContextClass()
  try {
    const audioBuffer = await context.decodeAudioData(await file.arrayBuffer())
    const sourceRate = audioBuffer.sampleRate
    const outputLength = Math.ceil(audioBuffer.length * TARGET_SAMPLE_RATE / sourceRate)
    const output = new Float32Array(outputLength)
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index))

    // Convert to mono 16 kHz PCM, the input format expected by Whisper.
    for (let index = 0; index < outputLength; index += 1) {
      const sourcePosition = index * sourceRate / TARGET_SAMPLE_RATE
      const left = Math.floor(sourcePosition)
      const right = Math.min(left + 1, audioBuffer.length - 1)
      const fraction = sourcePosition - left
      let sample = 0
      for (const channel of channels) {
        sample += channel[left] * (1 - fraction) + channel[right] * fraction
      }
      output[index] = sample / channels.length
    }
    return output
  } finally {
    await context.close()
  }
}

export async function transcribeUploadedAudioInBrowser(file, language, onProgress) {
  if (!file) throw new Error('Choose an audio file first.')
  const audio = await decodeAudioFile(file)
  if (!audio.length) throw new Error('The selected audio file is empty or could not be decoded.')

  const transcriber = await getTranscriber(onProgress)
  const result = await transcriber(audio, {
    language: WHISPER_LANGUAGES[language] || undefined,
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  })
  return (result?.text || '').trim()
}
