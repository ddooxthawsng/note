import { useEffect, useRef, useState } from 'react'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { MoonshineSpeech } from '@/shared/services/moonshineSpeech'

export function useSpeechToText(onTranscript: (text: string) => void, lang = 'vi-VN') {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const transcriptCallback = useRef(onTranscript)
  transcriptCallback.current = onTranscript

  const nativeMoonshine = Capacitor.isNativePlatform()
  const BrowserSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  useEffect(() => {
    if (!nativeMoonshine) return
    let disposed = false
    const handles: PluginListenerHandle[] = []

    void MoonshineSpeech.addListener('transcript', ({ text }) => {
      if (!disposed && text.trim()) transcriptCallback.current(text.trim())
    }).then((handle) => handles.push(handle))

    void MoonshineSpeech.addListener('status', ({ state, message }) => {
      if (disposed) return
      if (state === 'listening') setIsListening(true)
      if (state === 'stopped' || state === 'error') setIsListening(false)
      if (state === 'error' && message) console.error('Moonshine speech error:', message)
    }).then((handle) => handles.push(handle))

    return () => {
      disposed = true
      handles.forEach((handle) => void handle.remove())
    }
  }, [nativeMoonshine])

  useEffect(() => {
    if (nativeMoonshine || !BrowserSpeechRecognition) return

    const recognition = new BrowserSpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = lang
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript
      if (text) transcriptCallback.current(text)
    }
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event)
      setIsListening(false)
    }
    recognitionRef.current = recognition

    return () => {
      recognition.abort?.()
      recognitionRef.current = null
    }
  }, [BrowserSpeechRecognition, lang, nativeMoonshine])

  async function startListening() {
    if (nativeMoonshine) {
      setIsListening(true)
      try {
        await MoonshineSpeech.start({ language: lang.split('-')[0].toLowerCase() })
      } catch (error) {
        setIsListening(false)
        console.error('Moonshine failed to start', error)
        alert(`Moonshine could not start: ${(error as Error).message}`)
      }
      return
    }

    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser.')
      return
    }
    try {
      recognitionRef.current.start()
    } catch (error) {
      console.error(error)
    }
  }

  async function stopListening() {
    if (nativeMoonshine) {
      setIsListening(false)
      await MoonshineSpeech.stop().catch((error) => console.error('Moonshine failed to stop', error))
      return
    }
    recognitionRef.current?.stop()
  }

  function toggleListening() {
    void (isListening ? stopListening() : startListening())
  }

  return {
    isListening,
    toggleListening,
    isSupported: nativeMoonshine || Boolean(BrowserSpeechRecognition),
    engine: nativeMoonshine ? 'moonshine' : 'browser',
  }
}
