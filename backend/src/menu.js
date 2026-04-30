const ITEM_COLUMNS = `
  id, name, description, price, image_url, available, "order",
  is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, allergens
`;

const FLAG_FIELDS = ['is_vegetarian', 'is_vegan', 'is_gluten_free', 'is_lactose_free', 'is_spicy'];

const ALLERGEN_CODES = new Set(
  Array.from({ length: 14 }, (_, i) => String(i + 1))
);

function normalizeItem(it) {
  return {
    ...it,
    available: !!it.available,
    is_vegetarian: !!it.is_vegetarian,
    is_vegan: !!it.is_vegan,
    is_gluten_free: !!it.is_gluten_free,
    is_lactose_free: !!it.is_lactose_free,
    is_spicy: !!it.is_spicy,
    allergens: parseAllergens(it.allergens),
  };
}

function parseAllergens(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ALLERGEN_CODES.has(s));
}

function serializeAllergens(input) {
  if (input == null) return null;
  if (Array.isArray(input)) {
    const filtered = input.map((s) => String(s).trim()).filter((s) => ALLERGEN_CODES.has(s));
    return filtered.length ? filtered.join(',') : null;
  }
  return parseAllergens(input).join(',') || null;
}

module.exports = {
  ITEM_COLUMNS,
  FLAG_FIELDS,
  normalizeItem,
  parseAllergens,
  serializeAllergens,
};
