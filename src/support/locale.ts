import type { BrowserContext } from '@playwright/test';

export interface LocaleConfig {
  countryId: number;
  countryCode: string;
  currency: string;
}

// Country name (English) → site config mapping
const COUNTRY_MAP: Record<string, LocaleConfig> = {
  turkey:  { countryId: 1,  countryCode: 'TR', currency: 'TRY' },
  usa:     { countryId: 38, countryCode: 'US', currency: 'USD' },
  france:  { countryId: 7,  countryCode: 'FR', currency: 'EUR' },
  germany: { countryId: 2,  countryCode: 'DE', currency: 'EUR' },
  uk:      { countryId: 10, countryCode: 'GB', currency: 'GBP' },
  netherlands: { countryId: 9,  countryCode: 'NL', currency: 'EUR' },
  italy:   { countryId: 14, countryCode: 'IT', currency: 'EUR' },
  spain:   { countryId: 12, countryCode: 'ES', currency: 'EUR' },
  uae:     { countryId: 22, countryCode: 'AE', currency: 'AED' },
  'saudi arabia': { countryId: 34, countryCode: 'SA', currency: 'SAR' },
  australia: { countryId: 39, countryCode: 'AU', currency: 'AUD' },
  canada:  { countryId: 37, countryCode: 'CA', currency: 'CAD' },
  egypt:   { countryId: 32, countryCode: 'EG', currency: 'EGP' },
  malaysia: { countryId: 49, countryCode: 'MY', currency: 'MYR' },
};

// Supported language codes
const LANGUAGE_MAP: Record<string, string> = {
  en: 'EN',
  tr: 'TR',
  ar: 'AR',
  de: 'DE',
  english: 'EN',
  turkish: 'TR',
  arabic: 'AR',
  german: 'DE',
};

export function resolveCountry(name: string): LocaleConfig {
  const key = name.toLowerCase().trim();
  const config = COUNTRY_MAP[key];
  if (!config) {
    throw new Error(`Unknown country: "${name}". Available: ${Object.keys(COUNTRY_MAP).join(', ')}`);
  }
  return config;
}

export function resolveLanguage(lang: string): string {
  const key = lang.toLowerCase().trim();
  const code = LANGUAGE_MAP[key];
  if (!code) {
    throw new Error(`Unknown language: "${lang}". Available: ${Object.keys(LANGUAGE_MAP).join(', ')}`);
  }
  return code;
}

export async function setLocale(context: BrowserContext, country: string, language: string): Promise<void> {
  const countryConfig = resolveCountry(country);
  const langCode = resolveLanguage(language);

  const shippingData = JSON.stringify({
    currency: countryConfig.currency,
    country_id: countryConfig.countryId,
    country_code: countryConfig.countryCode,
    ip_welcome: '',
    ip_country_id: String(countryConfig.countryId),
    ip_country_code: countryConfig.countryCode,
    customer_language: langCode,
  });

  await context.addCookies([
    { name: 'user_shipping_data', value: encodeURIComponent(shippingData), domain: '.modanisa.com', path: '/' },
    { name: 'customer-shipping-country-id-1', value: String(countryConfig.countryId), domain: '.modanisa.com', path: '/' },
    { name: 'customer-language-1', value: langCode, domain: '.modanisa.com', path: '/' },
  ]);
}
