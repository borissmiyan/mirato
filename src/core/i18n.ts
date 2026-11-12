/// <reference types="vite/client" />
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Dynamic import of locale configs
const localeModules = import.meta.glob('./locales/*.ts', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;

const resources: Record<string, { translation: Record<string, unknown> }> = {};
const supportedLngs: string[] = [];

for (const path in localeModules) {
  const match = path.match(/\/([^/]+)\.ts$/);
  if (match) {
    const lng = match[1];
    resources[lng] = { translation: localeModules[path] };
    supportedLngs.push(lng);
  }
}

// Predefined map for language labels and flag codes (using ISO 3166-1 alpha-2 for react-world-flags)
export const LANGUAGE_METADATA: Record<string, { label: string; native: string; flag: string }> = {
  en: { label: 'English', native: 'English', flag: 'GB' },
  ru: { label: 'Русский', native: 'Russian', flag: 'RU' },
  de: { label: 'Deutsch', native: 'German', flag: 'DE' },
};

// Generates dynamic array of language configurations for the UI selector
export const getSupportedLanguages = () => {
  return supportedLngs.map(code => {
    const meta = LANGUAGE_METADATA[code] || {
      label: code.toUpperCase(),
      native: code.toUpperCase(),
      flag: code.toUpperCase()
    };
    return {
      code,
      label: meta.label,
      native: meta.native,
      flag: meta.flag
    };
  });
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    supportedLngs,
    resources,
    interpolation: {
      escapeValue: false,
    },
    returnObjects: true,
    returnEmptyString: false,
  });

export default i18n;