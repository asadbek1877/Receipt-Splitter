export const LANGUAGE_CODES = ['en', 'ja', 'uz'] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageOption {
  code: LanguageCode;
  shortLabel: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', shortLabel: 'EN', flag: '🇺🇸' },
  { code: 'ja', shortLabel: 'JA', flag: '🇯🇵' },
  { code: 'uz', shortLabel: 'UZ', flag: '🇺🇿' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
