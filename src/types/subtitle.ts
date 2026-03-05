export interface Word {
  start: number
  end: number
  word: string
  probability: number
}

export interface Segment {
  id: string
  start: number
  end: number
  text: string
  words: Word[]
}

export interface TranslatedSegment {
  id: string
  originalText: string
  translatedText: string
}

export type SubtitleFormat = 'srt' | 'vtt' | 'ass'
