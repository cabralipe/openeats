export interface School {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'pending';
  image?: string;
  publicSlug?: string;
  publicToken?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  status: 'critical' | 'adequate' | 'warning';
  nova_classification?: string;
  nova_classification_display?: string;
  nutritional_function?: string;
  nutritional_function_display?: string;
}

export interface MenuItem {
  day: string;
  date: string;
  lunch: string;
  snack: string;
  image: string;
}

export interface ConsumptionEntry {
  id: string;
  date: string;
  meal: string;
  type: string;
  served: number;
  repetitions: number;
}
