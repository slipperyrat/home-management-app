// Enhanced Shopping Suggestions AI Service
// Uses OpenAI for intelligent shopping recommendations with easy fallback

import { BaseAIService, AIResponse } from './BaseAIService';
import { createClient } from '@supabase/supabase-js';

export interface ShoppingSuggestion {
  type: 'frequently_bought' | 'category_based' | 'seasonal' | 'smart_templates' | 'ai_recommended';
  title: string;
  description: string;
  items: ShoppingItem[];
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  reasoning?: string;
}

export interface ShoppingItem {
  name: string;
  category: string;
  confidence: number;
  quantity?: string;
  estimatedPrice?: number;
  reasoning?: string;
}

export interface ShoppingContext {
  householdId: string;
  recentPurchases?: any[];
  dietaryRestrictions?: string[];
  budget?: number;
  season?: string;
  specialOccasions?: string[];
}

export class ShoppingSuggestionsAIService extends BaseAIService {
  private supabase: any;

  constructor() {
    super('shoppingSuggestions');
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async generateSuggestions(context: ShoppingContext): Promise<AIResponse<ShoppingSuggestion[]>> {
    return this.executeWithFallback(
      () => this.generateAISuggestions(context),
      () => this.getMockResponse(context),
      context
    );
  }

  private async generateAISuggestions(context: ShoppingContext): Promise<ShoppingSuggestion[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Get shopping history for context
    const shoppingHistory = await this.getShoppingHistory(context.householdId);
    
    // Create AI prompt
    const systemPrompt = `You are an AI shopping assistant that provides intelligent shopping recommendations based on household patterns, preferences, and context. 
    
    You must respond with valid JSON only. Be practical and helpful in your suggestions.`;

    const userPrompt = this.createShoppingPrompt(context, shoppingHistory);

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: this.createOpenAIPrompt(systemPrompt, userPrompt),
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 2000,
    });

    const aiContent = response.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No response from OpenAI');
    }

    return this.parseAIResponse(aiContent, []);
  }

  private createShoppingPrompt(context: ShoppingContext, shoppingHistory: any[]): string {
    const recentItems = shoppingHistory.slice(0, 20).map(item => ({
      name: item.name,
      category: item.category || 'General',
      date: item.created_at
    }));

    return `Generate shopping suggestions for a household based on the following context:

Household Context:
- Recent Purchases: ${JSON.stringify(recentItems)}
- Dietary Restrictions: ${context.dietaryRestrictions?.join(', ') || 'None'}
- Budget: ${context.budget ? `$${context.budget}` : 'Not specified'}
- Season: ${context.season || 'Current season'}
- Special Occasions: ${context.specialOccasions?.join(', ') || 'None'}

Please provide 3-5 different types of shopping suggestions in this JSON format:

[
  {
    "type": "frequently_bought",
    "title": "Frequently Bought Items",
    "description": "Items you buy regularly based on your shopping history",
    "items": [
      {
        "name": "Milk",
        "category": "Dairy",
        "confidence": 85,
        "quantity": "1 gallon",
        "estimatedPrice": 3.50,
        "reasoning": "Purchased weekly based on history"
      }
    ],
    "confidence": 90,
    "priority": "high",
    "reasoning": "Based on 15+ purchases in the last 3 months"
  },
  {
    "type": "ai_recommended",
    "title": "AI Smart Recommendations",
    "description": "Intelligent suggestions based on patterns and context",
    "items": [
      {
        "name": "Fresh Vegetables",
        "category": "Produce",
        "confidence": 80,
        "quantity": "Variety pack",
        "estimatedPrice": 12.00,
        "reasoning": "Healthy addition to weekly meals"
      }
    ],
    "confidence": 85,
    "priority": "medium",
    "reasoning": "Based on dietary preferences and seasonal availability"
  }
]

Focus on practical, useful suggestions that would genuinely help with household shopping.`;
  }

  private async getShoppingHistory(householdId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('shopping_items')
        .select(`
          *,
          shopping_lists!inner (
            household_id,
            created_at
          )
        `)
        .eq('shopping_lists.household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching shopping history:', error);
      return [];
    }
  }

  protected async getMockResponse(context?: ShoppingContext): Promise<ShoppingSuggestion[]> {
    // Enhanced mock response with better data
    const mockSuggestions: ShoppingSuggestion[] = [
      {
        type: 'frequently_bought',
        title: 'Frequently Bought Items',
        description: 'Items you buy regularly based on your shopping history',
        items: [
          {
            name: 'Milk',
            category: 'Dairy',
            confidence: 85,
            quantity: '1 gallon',
            estimatedPrice: 3.50,
            reasoning: 'Purchased weekly based on history'
          },
          {
            name: 'Bread',
            category: 'Bakery',
            confidence: 80,
            quantity: '1 loaf',
            estimatedPrice: 2.50,
            reasoning: 'Regular household staple'
          },
          {
            name: 'Eggs',
            category: 'Dairy',
            confidence: 75,
            quantity: '1 dozen',
            estimatedPrice: 4.00,
            reasoning: 'High protein breakfast option'
          }
        ],
        confidence: 80,
        priority: 'high',
        reasoning: 'Based on shopping history analysis'
      },
      {
        type: 'ai_recommended',
        title: 'AI Smart Recommendations',
        description: 'Intelligent suggestions based on patterns and context',
        items: [
          {
            name: 'Fresh Vegetables',
            category: 'Produce',
            confidence: 80,
            quantity: 'Variety pack',
            estimatedPrice: 12.00,
            reasoning: 'Healthy addition to weekly meals'
          },
          {
            name: 'Protein Source',
            category: 'Meat',
            confidence: 75,
            quantity: '2-3 lbs',
            estimatedPrice: 15.00,
            reasoning: 'Balanced nutrition for the week'
          }
        ],
        confidence: 75,
        priority: 'medium',
        reasoning: 'Based on dietary preferences and seasonal availability'
      },
      {
        type: 'seasonal',
        title: 'Seasonal Suggestions',
        description: 'Items that might be useful for the current season',
        items: this.getSeasonalItems(),
        confidence: 70,
        priority: 'medium',
        reasoning: 'Based on current season and weather patterns'
      }
    ];

    return mockSuggestions;
  }

  private getSeasonalItems(): ShoppingItem[] {
    const currentMonth = new Date().getMonth();
    
    // Spring (March-May)
    if (currentMonth >= 2 && currentMonth <= 4) {
      return [
        {
          name: 'Spring cleaning supplies',
          category: 'Household',
          confidence: 75,
          quantity: '1 set',
          estimatedPrice: 25.00,
          reasoning: 'Spring cleaning season'
        },
        {
          name: 'Garden supplies',
          category: 'Outdoor',
          confidence: 70,
          quantity: 'As needed',
          estimatedPrice: 30.00,
          reasoning: 'Gardening season begins'
        }
      ];
    }
    // Summer (June-August)
    else if (currentMonth >= 5 && currentMonth <= 7) {
      return [
        {
          name: 'BBQ supplies',
          category: 'Outdoor',
          confidence: 80,
          quantity: '1 set',
          estimatedPrice: 40.00,
          reasoning: 'Summer grilling season'
        },
        {
          name: 'Summer drinks',
          category: 'Beverages',
          confidence: 75,
          quantity: 'Variety',
          estimatedPrice: 15.00,
          reasoning: 'Hot weather refreshments'
        }
      ];
    }
    // Fall (September-November)
    else if (currentMonth >= 8 && currentMonth <= 10) {
      return [
        {
          name: 'Fall decorations',
          category: 'Home',
          confidence: 75,
          quantity: '1 set',
          estimatedPrice: 20.00,
          reasoning: 'Fall decorating season'
        },
        {
          name: 'Warm clothing',
          category: 'Clothing',
          confidence: 70,
          quantity: 'As needed',
          estimatedPrice: 50.00,
          reasoning: 'Cooler weather approaching'
        }
      ];
    }
    // Winter (December-February)
    else {
      return [
        {
          name: 'Winter clothing',
          category: 'Clothing',
          confidence: 80,
          quantity: 'As needed',
          estimatedPrice: 60.00,
          reasoning: 'Cold weather essentials'
        },
        {
          name: 'Holiday decorations',
          category: 'Home',
          confidence: 75,
          quantity: '1 set',
          estimatedPrice: 30.00,
          reasoning: 'Holiday season'
        }
      ];
    }
  }
}
