import { useState, useRef, useEffect } from 'react'

export function useSpeechToText(onTranscript: (text: string) => void, lang: string = 'vi-VN') {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      return
    }

    const rec = new SpeechRecognitionClass()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = lang

    rec.onstart = () => {
      setIsListening(true)
    }

    rec.onend = () => {
      setIsListening(false)
    }

    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript
      if (resultText) {
        onTranscript(resultText)
      }
    }

    rec.onerror = (event: any) => {
      console.error('Speech recognition error', event)
      setIsListening(false)
    }

    recognitionRef.current = rec
  }, [onTranscript, lang])

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.error(e)
      }
    } else {
      alert('Speech Recognition is not supported in this browser.')
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return {
    isListening,
    toggleListening,
    isSupported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
  }
}
