import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface MoonshineTranscriptEvent {
  text: string
}

export interface MoonshineStatusEvent {
  state: 'loading' | 'listening' | 'stopped' | 'error'
  message?: string
  progress?: number
  file?: string
}

interface MoonshineSpeechPlugin {
  start(options: { language: string }): Promise<{ listening: boolean }>
  stop(): Promise<void>
  addListener(eventName: 'transcript', listener: (event: MoonshineTranscriptEvent) => void): Promise<PluginListenerHandle>
  addListener(eventName: 'status', listener: (event: MoonshineStatusEvent) => void): Promise<PluginListenerHandle>
}

export const MoonshineSpeech = registerPlugin<MoonshineSpeechPlugin>('MoonshineSpeech')
