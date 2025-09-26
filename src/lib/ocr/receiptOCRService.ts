import { sb } from '@/lib/server/supabaseAdmin';

interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
  category?: string;
  brand?: string;
  unit?: string;
}

interface ReceiptData {
  store_name?: string;
  receipt_date?: string;
  total_amount?: number;
  items: ReceiptItem[];
  confidence: number;
}

interface OCRResult {
  success: boolean;
  data?: ReceiptData;
  error?: string;
  raw_text?: string;
}

/**
 * OCR Service for Receipt Processing
 * Uses a combination of pattern matching and AI to extract receipt data
 */
export class ReceiptOCRService {
  private supabase = sb();

  /**
   * Process a receipt image and extract structured data
   */
  async processReceipt(
    attachmentId: string,
    imageUrl: string,
    householdId: string
  ): Promise<OCRResult> {
    try {
      console.log(`🔍 Processing receipt for attachment ${attachmentId}`);

      // Step 1: Extract text from image (simulated OCR)
      const rawText = await this.extractTextFromImage(imageUrl);
      
      if (!rawText || rawText.trim().length === 0) {
        return {
          success: false,
          error: 'No text could be extracted from the image',
          raw_text: rawText
        };
      }

      // Step 2: Parse the extracted text to find receipt data
      const receiptData = await this.parseReceiptText(rawText, householdId);

      // Step 3: Store the OCR results
      await this.storeOCRResults(attachmentId, rawText, receiptData);

      // Step 4: Create receipt items
      if (receiptData.items.length > 0) {
        await this.createReceiptItems(attachmentId, householdId, receiptData.items);
      }

      // Step 5: Update price history
      if (receiptData.store_name && receiptData.total_amount) {
        await this.updatePriceHistory(householdId, receiptData);
      }

      console.log(`✅ Successfully processed receipt: ${receiptData.items.length} items extracted`);

      return {
        success: true,
        data: receiptData,
        raw_text: rawText
      };

    } catch (error) {
      console.error('❌ Error processing receipt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Extract text from image using OCR (simulated for now)
   * In production, this would integrate with Google Vision API, AWS Textract, or similar
   */
  private async extractTextFromImage(imageUrl: string): Promise<string> {
    try {
      // For now, we'll simulate OCR extraction
      // In production, you would integrate with a real OCR service
      
      // Simulate different receipt formats
      const mockReceipts = [
        `WALMART SUPERCENTER
1234 MAIN ST
ANYTOWN, ST 12345
(555) 123-4567

Date: 2024-01-15
Time: 14:32
Cashier: Sarah

MILK 2% GAL          3.47
BREAD WHITE          2.19
APPLES RED 3LB       4.99
CHICKEN BREAST 2LB   8.97
BANANAS 2LB          1.98
CEREAL FROSTED       4.29

SUBTOTAL            26.89
TAX                  2.15
TOTAL               29.04

Thank you for shopping at Walmart!`,
        
        `TARGET STORE #1234
456 OAK AVENUE
CITY, STATE 54321

Receipt #123456789
Date: 01/15/2024
Cashier: Mike

Tide Laundry Detergent    12.99
Paper Towels 6-pack        8.49
Greek Yogurt 4-pack        5.99
Granola Bars Family        6.79
Orange Juice 64oz          3.99

Subtotal                  38.25
Tax                        3.06
Total                     41.31

Target Circle rewards applied: $2.50`,
        
        `SAFEWAY #1234
789 PINE STREET
TOWN, CA 90210

Transaction: 001234567
Date: 01/15/24 Time: 16:45
Cashier: Lisa

Organic Spinach 5oz        2.99
Ground Beef 1lb           7.99
Rice Jasmine 2lb          4.49
Avocados 4ct              3.99
Sourdough Bread           2.79
Eggs Dozen                2.49

Subtotal                  24.74
Tax                        2.47
Total                     27.21

Thank you for shopping Safeway!`
      ];

      // Return a random mock receipt for demonstration
      const randomReceipt = mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
      
      console.log('📄 Simulated OCR extraction completed');
      return randomReceipt;

    } catch (error) {
      console.error('❌ Error extracting text from image:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Parse receipt text to extract structured data
   */
  private async parseReceiptText(text: string, householdId: string): Promise<ReceiptData> {
    try {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      let storeName = '';
      let receiptDate = '';
      let totalAmount = 0;
      const items: ReceiptItem[] = [];
      let confidence = 0.8; // Base confidence

      // Extract store name (usually first few lines)
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i].toUpperCase();
        if (line.includes('WALMART') || line.includes('TARGET') || line.includes('SAFEWAY') || 
            line.includes('STORE') || line.includes('MARKET')) {
          storeName = lines[i];
          break;
        }
      }

      // Extract date
      const datePatterns = [
        /Date:\s*(\d{4}-\d{2}-\d{2})/i,
        /Date:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /(\d{4}-\d{2}-\d{2})/,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/
      ];

      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          receiptDate = match[1];
          break;
        }
      }

      // Extract total amount
      const totalPatterns = [
        /TOTAL\s*\$?(\d+\.\d{2})/i,
        /Total\s*\$?(\d+\.\d{2})/i,
        /\$(\d+\.\d{2})\s*$/m
      ];

      for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match) {
          totalAmount = parseFloat(match[1]);
          break;
        }
      }

      // Extract items (lines with prices)
      const itemPattern = /^(.+?)\s+(\d+\.\d{2})$/;
      
      for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
          const itemName = match[1].trim();
          const price = parseFloat(match[2]);

          // Skip if it's a subtotal, tax, or total line
          if (itemName.toLowerCase().includes('subtotal') || 
              itemName.toLowerCase().includes('tax') || 
              itemName.toLowerCase().includes('total')) {
            continue;
          }

          // Categorize the item
          const category = this.categorizeItem(itemName);
          const brand = this.extractBrand(itemName);

          items.push({
            name: itemName,
            price: price,
            quantity: 1,
            category: category,
            brand: brand,
            unit: this.extractUnit(itemName)
          });
        }
      }

      // Calculate confidence based on extracted data
      if (storeName) confidence += 0.1;
      if (receiptDate) confidence += 0.1;
      if (totalAmount > 0) confidence += 0.1;
      if (items.length > 0) confidence += 0.1;

      return {
        store_name: storeName,
        receipt_date: receiptDate,
        total_amount: totalAmount,
        items: items,
        confidence: Math.min(confidence, 1.0)
      };

    } catch (error) {
      console.error('❌ Error parsing receipt text:', error);
      throw new Error('Failed to parse receipt text');
    }
  }

  /**
   * Categorize an item based on its name
   */
  private categorizeItem(itemName: string): string {
    const name = itemName.toLowerCase();
    
    const categories: Record<string, string[]> = {
      'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'produce': ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'spinach', 'avocado'],
      'meat': ['chicken', 'beef', 'pork', 'fish', 'turkey', 'bacon'],
      'bakery': ['bread', 'roll', 'bagel', 'muffin', 'cake'],
      'pantry': ['rice', 'pasta', 'cereal', 'flour', 'sugar', 'oil'],
      'beverages': ['juice', 'soda', 'water', 'coffee', 'tea'],
      'snacks': ['chips', 'cookies', 'crackers', 'nuts', 'granola'],
      'household': ['detergent', 'soap', 'paper', 'towel', 'cleaning'],
      'health': ['medicine', 'vitamin', 'supplement', 'bandage']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Extract brand from item name
   */
  private extractBrand(itemName: string): string | undefined {
    const brands = ['tide', 'tropicana', 'organic', 'great value', 'market pantry', 'simply'];
    
    for (const brand of brands) {
      if (itemName.toLowerCase().includes(brand)) {
        return brand.toUpperCase();
      }
    }

    return undefined;
  }

  /**
   * Extract unit from item name
   */
  private extractUnit(itemName: string): string | undefined {
    const units = ['lb', 'kg', 'oz', 'gal', 'ct', 'pack', 'dozen'];
    
    for (const unit of units) {
      if (itemName.toLowerCase().includes(unit)) {
        return unit;
      }
    }

    return undefined;
  }

  /**
   * Store OCR results in the database
   */
  private async storeOCRResults(
    attachmentId: string,
    rawText: string,
    receiptData: ReceiptData
  ): Promise<void> {
    const { error } = await this.supabase
      .from('attachments')
      .update({
        ocr_status: 'completed',
        ocr_confidence: receiptData.confidence,
        ocr_text: rawText,
        ocr_data: receiptData,
        receipt_total: receiptData.total_amount,
        receipt_date: receiptData.receipt_date ? new Date(receiptData.receipt_date) : null,
        receipt_store: receiptData.store_name,
        receipt_items: receiptData.items,
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', attachmentId);

    if (error) {
      console.error('❌ Error storing OCR results:', error);
      throw new Error('Failed to store OCR results');
    }
  }

  /**
   * Create receipt items in the database
   */
  private async createReceiptItems(
    attachmentId: string,
    householdId: string,
    items: ReceiptItem[]
  ): Promise<void> {
    const receiptItems = items.map(item => ({
      attachment_id: attachmentId,
      household_id: householdId,
      item_name: item.name,
      item_price: item.price,
      item_quantity: item.quantity || 1,
      item_category: item.category,
      item_brand: item.brand,
      item_unit: item.unit,
      confidence_score: 0.8 // Base confidence for extracted items
    }));

    const { error } = await this.supabase
      .from('receipt_items')
      .insert(receiptItems);

    if (error) {
      console.error('❌ Error creating receipt items:', error);
      throw new Error('Failed to create receipt items');
    }
  }

  /**
   * Update price history for items
   */
  private async updatePriceHistory(
    householdId: string,
    receiptData: ReceiptData
  ): Promise<void> {
    if (!receiptData.store_name || !receiptData.items.length) return;

    const priceEntries = receiptData.items.map(item => ({
      household_id: householdId,
      item_name: item.name,
      item_brand: item.brand,
      store_name: receiptData.store_name!,
      price: item.price,
      receipt_date: receiptData.receipt_date ? new Date(receiptData.receipt_date) : new Date(),
      price_per_unit: item.unit ? item.price : null,
      unit_type: item.unit
    }));

    const { error } = await this.supabase
      .from('price_history')
      .insert(priceEntries);

    if (error) {
      console.error('❌ Error updating price history:', error);
      // Don't throw here as price history is not critical
    }
  }
}
