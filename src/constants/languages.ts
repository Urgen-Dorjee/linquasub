export interface Language {
  code: string
  name: string
}

export const DEEPL_LANGUAGES: Language[] = [
  { code: 'BG', name: 'Bulgarian' },
  { code: 'CS', name: 'Czech' },
  { code: 'DA', name: 'Danish' },
  { code: 'DE', name: 'German' },
  { code: 'EL', name: 'Greek' },
  { code: 'EN-US', name: 'English (US)' },
  { code: 'EN-GB', name: 'English (UK)' },
  { code: 'ES', name: 'Spanish' },
  { code: 'ET', name: 'Estonian' },
  { code: 'FI', name: 'Finnish' },
  { code: 'FR', name: 'French' },
  { code: 'HU', name: 'Hungarian' },
  { code: 'ID', name: 'Indonesian' },
  { code: 'IT', name: 'Italian' },
  { code: 'JA', name: 'Japanese' },
  { code: 'KO', name: 'Korean' },
  { code: 'LT', name: 'Lithuanian' },
  { code: 'LV', name: 'Latvian' },
  { code: 'NB', name: 'Norwegian' },
  { code: 'NL', name: 'Dutch' },
  { code: 'PL', name: 'Polish' },
  { code: 'PT-BR', name: 'Portuguese (BR)' },
  { code: 'PT-PT', name: 'Portuguese (PT)' },
  { code: 'RO', name: 'Romanian' },
  { code: 'RU', name: 'Russian' },
  { code: 'SK', name: 'Slovak' },
  { code: 'SL', name: 'Slovenian' },
  { code: 'SV', name: 'Swedish' },
  { code: 'TR', name: 'Turkish' },
  { code: 'UK', name: 'Ukrainian' },
  { code: 'ZH', name: 'Chinese' },
]

export const GEMINI_LANGUAGES: Language[] = [
  { code: 'English', name: 'English' },
  { code: 'Spanish', name: 'Spanish' },
  { code: 'French', name: 'French' },
  { code: 'German', name: 'German' },
  { code: 'Italian', name: 'Italian' },
  { code: 'Portuguese', name: 'Portuguese' },
  { code: 'Russian', name: 'Russian' },
  { code: 'Japanese', name: 'Japanese' },
  { code: 'Korean', name: 'Korean' },
  { code: 'Chinese', name: 'Chinese (Simplified)' },
  { code: 'Traditional Chinese', name: 'Chinese (Traditional)' },
  { code: 'Arabic', name: 'Arabic' },
  { code: 'Hindi', name: 'Hindi' },
  { code: 'Bengali', name: 'Bengali' },
  { code: 'Tibetan', name: 'Tibetan' },
  { code: 'Nepali', name: 'Nepali' },
  { code: 'Thai', name: 'Thai' },
  { code: 'Vietnamese', name: 'Vietnamese' },
  { code: 'Indonesian', name: 'Indonesian' },
  { code: 'Malay', name: 'Malay' },
  { code: 'Turkish', name: 'Turkish' },
  { code: 'Polish', name: 'Polish' },
  { code: 'Dutch', name: 'Dutch' },
  { code: 'Swedish', name: 'Swedish' },
  { code: 'Norwegian', name: 'Norwegian' },
  { code: 'Danish', name: 'Danish' },
  { code: 'Finnish', name: 'Finnish' },
  { code: 'Greek', name: 'Greek' },
  { code: 'Czech', name: 'Czech' },
  { code: 'Romanian', name: 'Romanian' },
  { code: 'Hungarian', name: 'Hungarian' },
  { code: 'Bulgarian', name: 'Bulgarian' },
  { code: 'Ukrainian', name: 'Ukrainian' },
  { code: 'Hebrew', name: 'Hebrew' },
  { code: 'Persian', name: 'Persian' },
  { code: 'Urdu', name: 'Urdu' },
  { code: 'Tamil', name: 'Tamil' },
  { code: 'Telugu', name: 'Telugu' },
  { code: 'Kannada', name: 'Kannada' },
  { code: 'Malayalam', name: 'Malayalam' },
  { code: 'Swahili', name: 'Swahili' },
]

export function getLanguagesForEngine(engine: 'gemini' | 'deepl'): Language[] {
  return engine === 'gemini' ? GEMINI_LANGUAGES : DEEPL_LANGUAGES
}

export function getDefaultLanguageForEngine(engine: 'gemini' | 'deepl'): string {
  return engine === 'gemini' ? 'English' : 'EN-US'
}
