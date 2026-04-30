// EU allergen codes per regulation 1169/2011 — labels for both languages.
export const ALLERGENS = {
  '1': { cs: 'Lepek', en: 'Gluten' },
  '2': { cs: 'Korýši', en: 'Crustaceans' },
  '3': { cs: 'Vejce', en: 'Eggs' },
  '4': { cs: 'Ryby', en: 'Fish' },
  '5': { cs: 'Arašídy', en: 'Peanuts' },
  '6': { cs: 'Sója', en: 'Soybeans' },
  '7': { cs: 'Mléko', en: 'Milk' },
  '8': { cs: 'Skořápkové plody', en: 'Nuts' },
  '9': { cs: 'Celer', en: 'Celery' },
  '10': { cs: 'Hořčice', en: 'Mustard' },
  '11': { cs: 'Sezam', en: 'Sesame' },
  '12': { cs: 'Oxid siřičitý', en: 'Sulphites' },
  '13': { cs: 'Vlčí bob', en: 'Lupin' },
  '14': { cs: 'Měkkýši', en: 'Molluscs' },
};

export const ALLERGEN_CODES = Object.keys(ALLERGENS);

export function allergenLabel(code, lang) {
  return ALLERGENS[code]?.[lang] || code;
}

const STRINGS = {
  cs: {
    loading: 'Načítání…',
    error: 'Chyba',
    menuEmpty: 'Menu zatím není připravené.',
    noItems: 'Žádné položky.',
    unavailable: 'Momentálně nedostupné',
    contains: 'Obsahuje',
    searchPlaceholder: 'Hledat v menu…',
    noResults: 'Žádné položky neodpovídají filtru.',
    clearFilters: 'Zrušit filtry',
    filters: {
      vegetarian: 'Vegetariánské',
      vegan: 'Vegan',
      glutenFree: 'Bez lepku',
      lactoseFree: 'Bez laktózy',
      spicy: 'Pikantní',
    },
    badges: {
      vegetarian: 'Veg',
      vegan: 'Vegan',
      glutenFree: 'Bez lepku',
      lactoseFree: 'Bez laktózy',
      spicy: 'Pikantní',
    },
    languageLabel: 'CS',
  },
  en: {
    loading: 'Loading…',
    error: 'Error',
    menuEmpty: 'The menu is not ready yet.',
    noItems: 'No items.',
    unavailable: 'Currently unavailable',
    contains: 'Contains',
    searchPlaceholder: 'Search the menu…',
    noResults: 'No items match the filter.',
    clearFilters: 'Clear filters',
    filters: {
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      glutenFree: 'Gluten free',
      lactoseFree: 'Lactose free',
      spicy: 'Spicy',
    },
    badges: {
      vegetarian: 'Veg',
      vegan: 'Vegan',
      glutenFree: 'GF',
      lactoseFree: 'LF',
      spicy: 'Spicy',
    },
    languageLabel: 'EN',
  },
};

export function t(lang, path) {
  const parts = path.split('.');
  let cursor = STRINGS[lang] || STRINGS.cs;
  for (const p of parts) {
    cursor = cursor?.[p];
    if (cursor === undefined) return path;
  }
  return cursor;
}
