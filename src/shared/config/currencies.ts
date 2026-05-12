// Supported currencies with exchange rates (base: USD)
export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // Rate to USD (1 USD = X of this currency)
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'UZS', symbol: "so'm", name: 'Uzbek Sum', flag: '🇺🇿', rate: 12500 },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rate: 0.92 },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺', rate: 89 },
  { code: 'KZT', symbol: '₸', name: 'Kazakh Tenge', flag: '🇰🇿', rate: 450 },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rate: 0.79 },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷', rate: 30 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳', rate: 7.2 },
];

export const DEFAULT_CURRENCY = 'UZS';

export function getCurrency(code: string): CurrencyInfo {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrency(currencyCode);
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: currencyCode === 'UZS' || currencyCode === 'KZT' ? 0 : 2,
    maximumFractionDigits: currencyCode === 'UZS' || currencyCode === 'KZT' ? 0 : 2,
  });
  
  if (currencyCode === 'USD' || currencyCode === 'EUR' || currencyCode === 'GBP') {
    return `${currency.symbol}${formatted}`;
  }
  return `${formatted} ${currency.symbol}`;
}

export function convertCurrency(amount: number, fromCode: string, toCode: string): number {
  const fromCurrency = getCurrency(fromCode);
  const toCurrency = getCurrency(toCode);
  
  // Convert to USD first, then to target currency
  const inUSD = amount / fromCurrency.rate;
  return inUSD * toCurrency.rate;
}
