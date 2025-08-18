'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Edit3, MessageSquare } from 'lucide-react';

export interface AISuggestion {
  id: string;
  suggestion_type: string;
  suggestion_data: any;
  ai_reasoning: string;
  user_feedback: string;
  created_at: string;
  parsed_item?: {
    item_type: string;
    confidence_score: number;
    review_status: string;
    review_reason: string;
  };
}

export interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: AISuggestion | null;
  onSaveCorrection: (correction: CorrectionData) => Promise<void>;
}

export interface CorrectionData {
  suggestionId: string;
  correctionType: 'correct' | 'mark_done' | 'ignore' | 'custom';
  correctionData?: any;
  userNotes: string;
}

export function CorrectionModal({ isOpen, onClose, suggestion, onSaveCorrection }: CorrectionModalProps) {
  const [correctionType, setCorrectionType] = useState<'correct' | 'mark_done' | 'ignore' | 'custom'>('correct');
  const [userNotes, setUserNotes] = useState('');
  const [customData, setCustomData] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!suggestion) return null;

  const handleSave = async () => {
    if (!userNotes.trim()) {
      alert('Please provide notes about the correction');
      return;
    }

    setIsLoading(true);
    try {
      const correctionData: CorrectionData = {
        suggestionId: suggestion.id,
        correctionType,
        userNotes: userNotes.trim(),
        ...(correctionType === 'custom' && customData && { correctionData: JSON.parse(customData) })
      };

      await onSaveCorrection(correctionData);
      onClose();
      // Reset form
      setCorrectionType('correct');
      setUserNotes('');
      setCustomData('');
    } catch (error) {
      console.error('Failed to save correction:', error);
      alert('Failed to save correction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getCorrectionTypeDescription = (type: string) => {
    switch (type) {
      case 'correct': return 'Fix incorrect information';
      case 'mark_done': return 'Mark as completed';
      case 'ignore': return 'Ignore this suggestion';
      case 'custom': return 'Provide custom correction';
      default: return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="correction-modal-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            AI Suggestion Correction
          </DialogTitle>
          <div id="correction-modal-description" className="sr-only">
            Modal for correcting AI suggestions with options to fix information, mark as done, ignore, or provide custom corrections.
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Suggestion Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Original Suggestion</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{suggestion.suggestion_type}</Badge>
                {suggestion.parsed_item && (
                  <>
                    <Badge variant={suggestion.parsed_item.review_status === 'auto_approved' ? 'default' : 'destructive'}>
                      {suggestion.parsed_item.review_status}
                    </Badge>
                    <Badge variant="secondary">
                      {(suggestion.parsed_item.confidence_score * 100).toFixed(0)}% confidence
                    </Badge>
                  </>
                )}
              </div>
              
              <div className="text-sm">
                <strong>AI Reasoning:</strong>
                <p className="text-gray-600 mt-1">{suggestion.ai_reasoning}</p>
              </div>

              {suggestion.suggestion_data && (
                <div className="text-sm">
                  <strong>Extracted Data:</strong>
                  <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(suggestion.suggestion_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Correction Type Selection */}
          <div className="space-y-3">
            <Label htmlFor="correction-type">Correction Type</Label>
            <Select value={correctionType} onValueChange={(value: any) => setCorrectionType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correct">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Correct Information</span>
                  </div>
                </SelectItem>
                <SelectItem value="mark_done">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Mark as Done</span>
                  </div>
                </SelectItem>
                <SelectItem value="ignore">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>Ignore Suggestion</span>
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Custom Correction</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <p className="text-sm text-gray-600">
              {getCorrectionTypeDescription(correctionType)}
            </p>
          </div>

          {/* Custom Data Input (for custom corrections) */}
          {correctionType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-data">Custom Correction Data (JSON)</Label>
              <Textarea
                id="custom-data"
                placeholder='{"corrected_field": "new_value"}'
                value={customData}
                onChange={(e) => setCustomData(e.target.value)}
                className="font-mono text-sm"
                rows={3}
              />
              <p className="text-xs text-gray-500">
                Enter valid JSON with the corrected information
              </p>
            </div>
          )}

          {/* User Notes */}
          <div className="space-y-2">
            <Label htmlFor="user-notes">
              Notes about the correction *
            </Label>
            <Textarea
              id="user-notes"
              placeholder="Explain what was wrong and how it should be corrected..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={4}
              required
            />
            <p className="text-xs text-gray-500">
              Your feedback helps improve the AI system for future suggestions
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || !userNotes.trim()}
            className="min-w-[100px]"
          >
            {isLoading ? 'Saving...' : 'Save Correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
