export const VOICE_LANGUAGE_TAGS = [
  'ar-EG',
  'ar-SA',
  'bn-IN',
  'cs-CZ',
  'da-DK',
  'de-AT',
  'de-DE',
  'de-CH',
  'el-GR',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-IE',
  'en-IN',
  'en-NZ',
  'en-US',
  'en-ZA',
  'es-AR',
  'es-CO',
  'es-ES',
  'es-MX',
  'es-US',
  'fi-FI',
  'fil-PH',
  'fr-BE',
  'fr-CA',
  'fr-FR',
  'fr-CH',
  'he-IL',
  'hi-IN',
  'hu-HU',
  'id-ID',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'ms-MY',
  'nb-NO',
  'nl-BE',
  'nl-NL',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ro-RO',
  'ru-RU',
  'sv-SE',
  'ta-IN',
  'te-IN',
  'th-TH',
  'tr-TR',
  'uk-UA',
  'vi-VN',
  'zh-Hans-CN',
  'zh-Hant-HK',
  'zh-Hant-TW',
] as const

const VOICE_LANGUAGE_TAG_SET = new Set<string>(VOICE_LANGUAGE_TAGS)

export interface VoiceLanguageOption {
  label: string
  value: string
}

export function createVoiceLanguageOptions(
  displayLocale: string,
  currentValue: string,
) {
  const displayNames = new Intl.DisplayNames([displayLocale], {
    fallback: 'code',
    languageDisplay: 'dialect',
    type: 'language',
  })
  const collator = new Intl.Collator(displayLocale, { sensitivity: 'base' })
  const options: VoiceLanguageOption[] = VOICE_LANGUAGE_TAGS.map(value => ({
    label: displayNames.of(value) ?? value,
    value,
  }))

  if (currentValue && !VOICE_LANGUAGE_TAG_SET.has(currentValue)) {
    options.push({ label: currentValue, value: currentValue })
  }

  return options.toSorted((left, right) =>
    collator.compare(left.label, right.label))
}

export function filterVoiceLanguageOption(
  option: VoiceLanguageOption,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery)
    return true

  return `${option.label} ${option.value}`
    .toLocaleLowerCase()
    .includes(normalizedQuery)
}
