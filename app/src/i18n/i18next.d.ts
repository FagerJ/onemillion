import 'i18next'
import type { en } from './en'

// Typed keys: t('home.tabel') fails the build instead of rendering the key.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
