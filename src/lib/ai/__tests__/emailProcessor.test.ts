import { AIEmailProcessor } from '../emailProcessor';

describe('AIEmailProcessor - Delivery Date Parsing & Confidence Thresholds', () => {
  let processor: AIEmailProcessor;

  beforeEach(() => {
    processor = new AIEmailProcessor();
  });

  describe('parseDeliveryDate', () => {
    // Test 1: "Expected: Wed 21 Aug" format
    it('should parse "Expected: Wed 21 Aug" format correctly', () => {
      const result = (processor as any).parseDeliveryDate('Expected: Wed 21 Aug');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 2: "Delivery by August 21" format
    it('should parse "Delivery by August 21" format correctly', () => {
      const result = (processor as any).parseDeliveryDate('Delivery by August 21');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 3: "Arriving: 21 Aug" format
    it('should parse "Arriving: 21 Aug" format correctly', () => {
      const result = (processor as any).parseDeliveryDate('Arriving: 21 Aug');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 4: "ETA: 21 Aug" format
    it('should parse "ETA: 21 Aug" format correctly', () => {
      const result = (processor as any).parseDeliveryDate('ETA: 21 Aug');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 5: "Scheduled: 21 Aug" format
    it('should parse "Scheduled: 21 Aug" format correctly', () => {
      const result = (processor as any).parseDeliveryDate('Scheduled: 21 Aug');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 6: Handle missing dates gracefully
    it('should return null for undefined or empty dates', () => {
      expect((processor as any).parseDeliveryDate(undefined)).toBeNull();
      expect((processor as any).parseDeliveryDate('')).toBeNull();
      expect((processor as any).parseDeliveryDate('   ')).toBeNull();
    });

    // Test 7: Handle malformed dates gracefully
    it('should return null for malformed dates', () => {
      expect((processor as any).parseDeliveryDate('Invalid Date')).toBeNull();
      expect((processor as any).parseDeliveryDate('Not a date')).toBeNull();
      expect((processor as any).parseDeliveryDate('12345')).toBeNull();
    });
  });

  describe('parseRelativeDate', () => {
    // Test 8: "Wed 21 Aug" format
    it('should parse "Wed 21 Aug" format correctly', () => {
      const result = (processor as any).parseRelativeDate('Wed 21 Aug');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 9: "August 21" format
    it('should parse "August 21" format correctly', () => {
      const result = (processor as any).parseRelativeDate('August 21');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 10: "21 Aug" format
    it('should parse "21 Aug" format correctly', () => {
      const result = (processor as any).parseRelativeDate('21 Aug');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 11: "21/08" format
    it('should parse "21/08" format correctly', () => {
      const result = (processor as any).parseRelativeDate('21/08');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 12: "08/21" format
    it('should parse "08/21" format correctly', () => {
      const result = (processor as any).parseRelativeDate('08/21');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 13: "21-08" format
    it('should parse "21-08" format correctly', () => {
      const result = (processor as any).parseRelativeDate('21-08');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 14: "08-21" format
    it('should parse "08-21" format correctly', () => {
      const result = (processor as any).parseRelativeDate('08-21');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // Test 15: ISO string format
    it('should parse ISO string format correctly', () => {
      const isoDate = '2024-08-21T10:00:00Z';
      const result = (processor as any).parseRelativeDate(isoDate);
      expect(result).toBe(isoDate);
    });

    // Test 16: Handle edge cases gracefully
    it('should handle edge cases gracefully', () => {
      expect((processor as any).parseRelativeDate('')).toBeNull();
      expect((processor as any).parseRelativeDate('   ')).toBeNull();
      expect((processor as any).parseRelativeDate('Invalid')).toBeNull();
    });
  });

  describe('validateAndTransformItem with delivery fields', () => {
    it('should parse delivery dates for delivery items', () => {
      const deliveryItem = {
        itemType: 'delivery',
        confidenceScore: 0.95,
        extractedData: { delivery: 'test' },
        deliveryDate: 'Expected: Wed 21 Aug',
        deliveryProvider: 'Amazon',
        deliveryTrackingNumber: '1Z999AA1234567890',
        deliveryStatus: 'In Transit'
      };

      const result = (processor as any).validateAndTransformItem(deliveryItem);
      
      expect(result.itemType).toBe('delivery');
      expect(result.deliveryDate).toBeTruthy();
      expect(result.deliveryProvider).toBe('Amazon');
      expect(result.deliveryTrackingNumber).toBe('1Z999AA1234567890');
      expect(result.deliveryStatus).toBe('In Transit');
      expect(typeof result.deliveryDate).toBe('string');
      expect(result.deliveryDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should have review status and reason based on confidence', () => {
      expect(result.reviewStatus).toBe('auto_approved');
      expect(result.reviewReason).toContain('High confidence');
      expect(result.reviewReason).toContain('Auto-approved');
    });
  });

    it('should not parse delivery dates for non-delivery items', () => {
      const billItem = {
        itemType: 'bill',
        confidenceScore: 0.95,
        extractedData: { bill: 'test' },
        deliveryDate: 'Expected: Wed 21 Aug'
      };

      const result = (processor as any).validateAndTransformItem(billItem);
      
      expect(result.itemType).toBe('bill');
      expect(result.deliveryDate).toBeUndefined();
    });

    it('should handle null delivery dates gracefully', () => {
      const deliveryItem = {
        itemType: 'delivery',
        confidenceScore: 0.95,
        extractedData: { delivery: 'test' },
        deliveryDate: 'Invalid Date Format',
        deliveryProvider: 'Amazon'
      };

      const result = (processor as any).validateAndTransformItem(deliveryItem);
      
      expect(result.itemType).toBe('delivery');
      expect(result.deliveryDate).toBeNull();
      expect(result.reviewStatus).toBe('needs_review');
      expect(result.reviewReason).toContain('Low confidence');
      expect(result.reviewReason).toContain('Needs human review');
    });
  });

  describe('Confidence Threshold System', () => {
    it('should flag high confidence items as auto_approved', () => {
      const highConfidenceItem = {
        itemType: 'bill',
        confidenceScore: 0.95,
        extractedData: { bill: 'test' }
      };

      const result = (processor as any).validateAndTransformItem(highConfidenceItem);
      
      expect(result.reviewStatus).toBe('auto_approved');
      expect(result.reviewReason).toContain('High confidence');
      expect(result.reviewReason).toContain('Auto-approved');
    });

    it('should flag medium confidence items as auto_approved', () => {
      const mediumConfidenceItem = {
        itemType: 'receipt',
        confidenceScore: 0.80,
        extractedData: { receipt: 'test' }
      };

      const result = (processor as any).validateAndTransformItem(mediumConfidenceItem);
      
      expect(result.reviewStatus).toBe('auto_approved');
      expect(result.reviewReason).toContain('Medium confidence');
      expect(result.reviewReason).toContain('Auto-approved');
    });

    it('should flag low confidence items as needs_review', () => {
      const lowConfidenceItem = {
        itemType: 'event',
        confidenceScore: 0.60,
        extractedData: { event: 'test' }
      };

      const result = (processor as any).validateAndTransformItem(lowConfidenceItem);
      
      expect(result.reviewStatus).toBe('needs_review');
      expect(result.reviewReason).toContain('Low confidence');
      expect(result.reviewReason).toContain('Needs human review');
    });

    it('should calculate confidence statistics correctly', () => {
      const testItems = [
        { itemType: 'bill', confidenceScore: 0.95, extractedData: {}, reviewStatus: 'auto_approved', reviewReason: 'test' },
        { itemType: 'receipt', confidenceScore: 0.80, extractedData: {}, reviewStatus: 'auto_approved', reviewReason: 'test' },
        { itemType: 'event', confidenceScore: 0.60, extractedData: {}, reviewStatus: 'needs_review', reviewReason: 'test' }
      ];

      const stats = (processor as any).calculateConfidenceStats(testItems);
      
      expect(stats.totalItems).toBe(3);
      expect(stats.averageConfidence).toBe(0.783);
      expect(stats.confidenceDistribution.high).toBe(1);
      expect(stats.confidenceDistribution.medium).toBe(1);
      expect(stats.confidenceDistribution.low).toBe(1);
      expect(stats.reviewDistribution.auto_approved).toBe(2);
      expect(stats.reviewDistribution.needs_review).toBe(1);
      expect(stats.lowConfidenceItems).toHaveLength(1);
      expect(stats.lowConfidenceItems[0].confidence).toBe(0.60);
    });
  });
});
