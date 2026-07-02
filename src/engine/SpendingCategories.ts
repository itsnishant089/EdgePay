// ─── Spending Categories Engine ─────────────────────────────────────
// Auto-detect transaction categories based on merchant name / UPI ID patterns

export interface SpendingCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  keywords: string[];
}

export const CATEGORIES: SpendingCategory[] = [
  {
    id: 'food',
    label: 'Food & Dining',
    icon: '🍔',
    color: '#FF9500',
    keywords: ['zomato', 'swiggy', 'domino', 'mcdonald', 'kfc', 'pizza', 'burger', 'food', 'restaurant', 'cafe', 'hotel', 'biryani', 'chai', 'tea', 'coffee', 'starbucks', 'subway', 'dining', 'kitchen', 'mess', 'canteen', 'dhaba', 'bakery', 'haldiram'],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    icon: '🛒',
    color: '#AF52DE',
    keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'shop', 'store', 'mart', 'mall', 'retail', 'reliance', 'dmart', 'bigbasket', 'blinkit', 'zepto', 'jiomart', 'croma', 'electronics'],
  },
  {
    id: 'travel',
    label: 'Travel',
    icon: '🚕',
    color: '#5856D6',
    keywords: ['uber', 'ola', 'rapido', 'irctc', 'rail', 'metro', 'bus', 'flight', 'makemytrip', 'goibibo', 'redbus', 'travel', 'cab', 'auto', 'rickshaw', 'petrol', 'diesel', 'parking', 'toll', 'fastag'],
  },
  {
    id: 'fuel',
    label: 'Fuel',
    icon: '⛽',
    color: '#FF6B6B',
    keywords: ['petrol', 'diesel', 'fuel', 'hp', 'iocl', 'bpcl', 'indian oil', 'bharat petroleum', 'hindustan petroleum', 'shell', 'pump', 'gas station'],
  },
  {
    id: 'bills',
    label: 'Bills & Utilities',
    icon: '💡',
    color: '#00C7BE',
    keywords: ['electricity', 'water', 'gas', 'recharge', 'jio', 'airtel', 'vi', 'bsnl', 'broadband', 'wifi', 'internet', 'bill', 'postpaid', 'prepaid', 'dth', 'tata', 'adani', 'bescom', 'mseb'],
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    icon: '🎮',
    color: '#FF2D55',
    keywords: ['netflix', 'hotstar', 'prime', 'spotify', 'youtube', 'game', 'cinema', 'movie', 'pvr', 'inox', 'bookmyshow', 'ticket', 'music', 'stream', 'disney'],
  },
  {
    id: 'health',
    label: 'Health',
    icon: '🏥',
    color: '#34C759',
    keywords: ['hospital', 'doctor', 'medical', 'pharmacy', 'medicine', 'apollo', 'pharmeasy', 'netmeds', '1mg', 'clinic', 'lab', 'test', 'health', 'dental', 'eye', 'gym', 'fitness'],
  },
  {
    id: 'education',
    label: 'Education',
    icon: '🎓',
    color: '#007AFF',
    keywords: ['school', 'college', 'university', 'tuition', 'course', 'udemy', 'coursera', 'unacademy', 'byjus', 'book', 'stationery', 'exam', 'fee', 'coaching', 'physicswallah', 'pw'],
  },
  {
    id: 'rent',
    label: 'Rent',
    icon: '🏠',
    color: '#5856D6',
    keywords: ['rent', 'landlord', 'lease', 'housing', 'flat', 'room'],
  },
  {
    id: 'salary',
    label: 'Salary',
    icon: '💼',
    color: '#34C759',
    keywords: ['salary', 'payroll', 'wages', 'stipend'],
  },
  {
    id: 'gifts',
    label: 'Gifts',
    icon: '🎁',
    color: '#FF2D55',
    keywords: ['gift', 'donation', 'charity'],
  },
  {
    id: 'emi',
    label: 'EMI & Loans',
    icon: '💳',
    color: '#FF9500',
    keywords: ['emi', 'loan', 'bajaj', 'hdfc loan', 'sbi loan', 'repayment'],
  },
  {
    id: 'investment',
    label: 'Investment',
    icon: '📈',
    color: '#00C7BE',
    keywords: ['zerodha', 'groww', 'mutual', 'sip', 'stock', 'invest', 'nse', 'bse'],
  },
  {
    id: 'recharge',
    label: 'Mobile Recharge',
    icon: '📱',
    color: '#5AC8FA',
    keywords: ['recharge', 'prepaid', 'postpaid', 'jio', 'airtel', 'vi', 'bsnl'],
  },
  {
    id: 'others',
    label: 'Others',
    icon: '📦',
    color: '#8E8E93',
    keywords: [],
  },
];

/**
 * Detect category from receiver name or UPI ID
 */
export function detectCategory(receiverName?: string, upiId?: string): SpendingCategory {
  const searchText = `${receiverName || ''} ${upiId || ''}`.toLowerCase();
  
  for (const category of CATEGORIES) {
    if (category.id === 'others') continue; // Skip "others" — it's the fallback
    for (const keyword of category.keywords) {
      if (searchText.includes(keyword)) {
        return category;
      }
    }
  }
  
  return CATEGORIES[CATEGORIES.length - 1]; // "Others"
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): SpendingCategory {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

/**
 * Categorize an array of transactions and return spending per category
 */
export function categorizeSpending(
  transactions: Array<{ amount: number; receiverName?: string; upiId?: string; status: string; timestamp: number }>,
  filterFn?: (t: any) => boolean,
): Record<string, number> {
  const result: Record<string, number> = {};
  CATEGORIES.forEach(c => { result[c.id] = 0; });

  transactions
    .filter(t => t.status !== 'RECEIVED' && t.status !== 'FAILED' && t.status !== 'CANCELLED')
    .filter(filterFn || (() => true))
    .forEach(t => {
      const cat = detectCategory(t.receiverName, t.upiId);
      result[cat.id] += t.amount;
    });

  return result;
}
