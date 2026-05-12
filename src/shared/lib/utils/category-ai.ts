// src/shared/lib/utils/category-ai.ts
// Smart Category AI - automatically categorizes items based on their names

export type CategoryType = 
  | 'food'
  | 'drinks'
  | 'transport'
  | 'entertainment'
  | 'shopping'
  | 'groceries'
  | 'utilities'
  | 'health'
  | 'education'
  | 'other';

export interface CategoryInfo {
  id: CategoryType;
  name: string;
  nameUz: string;
  icon: string;
  color: string;
  keywords: string[];
}

// Category definitions with keywords for matching
export const CATEGORIES: Record<CategoryType, CategoryInfo> = {
  food: {
    id: 'food',
    name: 'Food & Restaurants',
    nameUz: 'Ovqat & Restoranlar',
    icon: '🍕',
    color: '#e74c3c',
    keywords: [
      'pizza', 'burger', 'chicken', 'beef', 'meat', 'fish', 'sushi', 'ramen', 'noodle',
      'rice', 'soup', 'salad', 'sandwich', 'pasta', 'steak', 'kebab', 'shashlik',
      'plov', 'osh', 'lagman', 'manti', 'somsa', 'samsa', 'non', 'bread',
      'restaurant', 'cafe', 'bistro', 'diner', 'food', 'meal', 'lunch', 'dinner',
      'breakfast', 'snack', 'appetizer', 'dessert', 'cake', 'ice cream', 'donut',
      'mcdonalds', 'kfc', 'subway', 'dominos', 'papa johns', 'evos', 'max way',
      'hookah', 'choyxona', 'oshxona',
    ],
  },
  drinks: {
    id: 'drinks',
    name: 'Drinks & Beverages',
    nameUz: 'Ichimliklar',
    icon: '🥤',
    color: '#3498db',
    keywords: [
      'coffee', 'tea', 'juice', 'water', 'soda', 'cola', 'pepsi', 'fanta', 'sprite',
      'beer', 'wine', 'vodka', 'whiskey', 'cocktail', 'drink', 'beverage',
      'smoothie', 'shake', 'milkshake', 'latte', 'cappuccino', 'espresso',
      'americano', 'mocha', 'frappe', 'bubble tea', 'boba', 'choy', 'kofe',
      'starbucks', 'costa', 'coffee house', 'bar',
    ],
  },
  transport: {
    id: 'transport',
    name: 'Transport',
    nameUz: 'Transport',
    icon: '🚗',
    color: '#9b59b6',
    keywords: [
      'taxi', 'uber', 'yandex', 'bolt', 'mycar', 'bus', 'metro', 'train',
      'petrol', 'gas', 'fuel', 'benzin', 'diesel', 'parking', 'toll',
      'car wash', 'car service', 'repair', 'tire', 'oil change',
      'flight', 'airline', 'airport', 'ticket', 'railway', 'travel',
    ],
  },
  entertainment: {
    id: 'entertainment',
    name: 'Entertainment',
    nameUz: 'Ko\'ngil ochar',
    icon: '🎬',
    color: '#e91e63',
    keywords: [
      'movie', 'cinema', 'film', 'theater', 'theatre', 'concert', 'show',
      'game', 'gaming', 'playstation', 'xbox', 'steam', 'netflix', 'spotify',
      'youtube', 'subscription', 'music', 'party', 'club', 'disco',
      'bowling', 'billiard', 'karaoke', 'escape room', 'quest', 'zoo',
      'park', 'amusement', 'attraction', 'museum', 'gallery', 'exhibition',
      'sport', 'gym', 'fitness', 'swimming', 'pool', 'stadium', 'match',
    ],
  },
  shopping: {
    id: 'shopping',
    name: 'Shopping',
    nameUz: 'Xarid',
    icon: '🛍️',
    color: '#f39c12',
    keywords: [
      'shop', 'store', 'mall', 'market', 'boutique', 'clothes', 'clothing',
      'shoes', 'bag', 'accessories', 'jewelry', 'watch', 'perfume', 'cosmetics',
      'makeup', 'skincare', 'electronics', 'phone', 'laptop', 'computer',
      'tablet', 'headphones', 'charger', 'case', 'furniture', 'home decor',
      'zara', 'h&m', 'nike', 'adidas', 'samsung', 'apple', 'xiaomi',
      'korzinka', 'makro', 'carrefour', 'havas', 'next', 'mega planet',
    ],
  },
  groceries: {
    id: 'groceries',
    name: 'Groceries',
    nameUz: 'Oziq-ovqat do\'koni',
    icon: '🛒',
    color: '#2ECC71',
    keywords: [
      'grocery', 'supermarket', 'vegetables', 'fruits', 'meat', 'dairy',
      'milk', 'eggs', 'cheese', 'butter', 'yogurt', 'bread', 'flour',
      'sugar', 'salt', 'oil', 'rice', 'pasta', 'cereal', 'snacks',
      'chips', 'cookies', 'chocolate', 'candy', 'frozen', 'canned',
      'bozor', 'market', 'mini market', 'dokon', 'magazin',
    ],
  },
  utilities: {
    id: 'utilities',
    name: 'Utilities & Bills',
    nameUz: 'Kommunal xizmatlar',
    icon: '💡',
    color: '#1abc9c',
    keywords: [
      'electricity', 'water', 'gas', 'internet', 'phone', 'mobile',
      'rent', 'apartment', 'house', 'maintenance', 'cleaning', 'laundry',
      'utility', 'bill', 'payment', 'subscription', 'insurance',
      'beeline', 'ucell', 'mobiuz', 'uzmobile', 'uztelecom',
      'click', 'payme', 'uzum',
    ],
  },
  health: {
    id: 'health',
    name: 'Health & Medical',
    nameUz: 'Sog\'liq',
    icon: '💊',
    color: '#00bcd4',
    keywords: [
      'hospital', 'clinic', 'doctor', 'dentist', 'pharmacy', 'medicine',
      'drug', 'pill', 'vitamin', 'supplement', 'test', 'analysis',
      'checkup', 'consultation', 'surgery', 'treatment', 'therapy',
      'ambulance', 'emergency', 'health', 'medical', 'dorixona', 'apteka',
      'shifokor', 'kasalxona', 'poliklinika',
    ],
  },
  education: {
    id: 'education',
    name: 'Education',
    nameUz: 'Ta\'lim',
    icon: '📚',
    color: '#ff9800',
    keywords: [
      'school', 'university', 'college', 'course', 'class', 'lesson',
      'tutor', 'teacher', 'book', 'textbook', 'notebook', 'stationery',
      'pen', 'pencil', 'exam', 'test', 'certificate', 'diploma',
      'training', 'workshop', 'seminar', 'conference', 'education',
      'maktab', 'universitet', 'kurs', 'darslik', 'kitob',
    ],
  },
  other: {
    id: 'other',
    name: 'Other',
    nameUz: 'Boshqa',
    icon: '📦',
    color: '#607d8b',
    keywords: [],
  },
};

/**
 * Normalize text for matching (lowercase, remove special chars)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate match score for a category based on keywords
 */
function calculateScore(text: string, category: CategoryInfo): number {
  const normalized = normalizeText(text);
  const words = normalized.split(' ');
  let score = 0;

  for (const keyword of category.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    
    // Exact word match (higher score)
    if (words.includes(normalizedKeyword)) {
      score += 10;
      continue;
    }
    
    // Partial match (lower score)
    if (normalized.includes(normalizedKeyword)) {
      score += 5;
      continue;
    }
    
    // Fuzzy match for multi-word keywords
    if (normalizedKeyword.includes(' ')) {
      const keywordWords = normalizedKeyword.split(' ');
      const matchedWords = keywordWords.filter(kw => normalized.includes(kw));
      if (matchedWords.length > 0) {
        score += matchedWords.length * 2;
      }
    }
  }

  return score;
}

/**
 * Detect category from item name using AI-like keyword matching
 */
export function detectCategory(itemName: string): CategoryInfo {
  if (!itemName || itemName.trim().length === 0) {
    return CATEGORIES.other;
  }

  let bestMatch: CategoryInfo = CATEGORIES.other;
  let bestScore = 0;

  for (const categoryKey of Object.keys(CATEGORIES) as CategoryType[]) {
    if (categoryKey === 'other') continue;
    
    const category = CATEGORIES[categoryKey];
    const score = calculateScore(itemName, category);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  // Return 'other' if no good match found
  return bestScore > 0 ? bestMatch : CATEGORIES.other;
}

/**
 * Detect categories for multiple items
 */
export function detectCategories(items: Array<{ name: string; amount: number }>): Map<CategoryType, number> {
  const categoryTotals = new Map<CategoryType, number>();
  
  for (const item of items) {
    const category = detectCategory(item.name);
    const current = categoryTotals.get(category.id) || 0;
    categoryTotals.set(category.id, current + item.amount);
  }
  
  return categoryTotals;
}

/**
 * Get category summary with percentages
 */
export function getCategorySummary(items: Array<{ name: string; amount: number }>): Array<{
  category: CategoryInfo;
  amount: number;
  percentage: number;
  itemCount: number;
}> {
  const categoryData = new Map<CategoryType, { amount: number; count: number }>();
  let totalAmount = 0;
  
  for (const item of items) {
    const category = detectCategory(item.name);
    const current = categoryData.get(category.id) || { amount: 0, count: 0 };
    categoryData.set(category.id, {
      amount: current.amount + item.amount,
      count: current.count + 1,
    });
    totalAmount += item.amount;
  }
  
  const result: Array<{
    category: CategoryInfo;
    amount: number;
    percentage: number;
    itemCount: number;
  }> = [];
  
  for (const [categoryId, data] of categoryData) {
    result.push({
      category: CATEGORIES[categoryId],
      amount: data.amount,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      itemCount: data.count,
    });
  }
  
  // Sort by amount descending
  result.sort((a, b) => b.amount - a.amount);
  
  return result;
}

/**
 * Suggest category based on partial input (for autocomplete)
 */
export function suggestCategories(partialText: string, limit: number = 3): CategoryInfo[] {
  if (!partialText || partialText.trim().length < 2) {
    return [];
  }

  const scores: Array<{ category: CategoryInfo; score: number }> = [];

  for (const categoryKey of Object.keys(CATEGORIES) as CategoryType[]) {
    if (categoryKey === 'other') continue;
    
    const category = CATEGORIES[categoryKey];
    const score = calculateScore(partialText, category);
    
    if (score > 0) {
      scores.push({ category, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  
  return scores.slice(0, limit).map(s => s.category);
}

/**
 * Get all categories for display
 */
export function getAllCategories(): CategoryInfo[] {
  return Object.values(CATEGORIES);
}

/**
 * Get category by ID
 */
export function getCategoryById(id: CategoryType): CategoryInfo {
  return CATEGORIES[id] || CATEGORIES.other;
}
