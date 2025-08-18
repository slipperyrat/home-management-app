'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Edit3, 
  MessageSquare, 
  Clock,
  AlertTriangle
} from 'lucide-react';
import { CorrectionModal, CorrectionData, AISuggestion } from './CorrectionModal';

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onCorrectionSaved?: () => void;
}

export function SuggestionCard({ suggestion, onCorrectionSaved }: SuggestionCardProps) {
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveCorrection = async (correction: CorrectionData): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(correction),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save correction');
      }

      // Call the callback to refresh data
      if (onCorrectionSaved) {
        onCorrectionSaved();
      }
    } catch (error) {
      console.error('Error saving correction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'bill_action': return <AlertTriangle className="w-4 h-4" />;
      case 'shopping_list_update': return <CheckCircle className="w-4 h-4" />;
      case 'calendar_event': return <Clock className="w-4 h-4" />;
      case 'chore_creation': return <Edit3 className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };



  const getStatusBadge = (feedback: string) => {
    switch (feedback) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'corrected':
        return <Badge variant="secondary">Corrected</Badge>;
      case 'ignored':
        return <Badge variant="outline">Ignored</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {getSuggestionIcon(suggestion.suggestion_type)}
              <CardTitle className="text-lg">
                {suggestion.suggestion_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {suggestion.parsed_item && (
                <Badge 
                  variant={suggestion.parsed_item.review_status === 'auto_approved' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {suggestion.parsed_item.review_status === 'auto_approved' ? 'Auto-approved' : 'Needs Review'}
                </Badge>
              )}
              {suggestion.parsed_item && (
                <Badge variant="secondary" className="text-xs">
                  {(suggestion.parsed_item.confidence_score * 100).toFixed(0)}% confidence
                </Badge>
              )}
              {getStatusBadge(suggestion.user_feedback)}
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {formatDate(suggestion.created_at)}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* AI Reasoning */}
          <div>
            <h4 className="font-medium text-sm text-gray-700 mb-1">AI Reasoning:</h4>
            <p className="text-sm text-gray-600">{suggestion.ai_reasoning}</p>
          </div>

          {/* Suggestion Data */}
          {suggestion.suggestion_data && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-1">Extracted Data:</h4>
              <div className="bg-gray-50 p-3 rounded-md">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(suggestion.suggestion_data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {suggestion.user_feedback === 'pending' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCorrectionModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Correct
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const correction: CorrectionData = {
                    suggestionId: suggestion.id,
                    correctionType: 'mark_done',
                    userNotes: 'Marked as completed by user'
                  };
                  handleSaveCorrection(correction);
                }}
                className="flex items-center gap-2"
                disabled={isLoading}
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Done
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const correction: CorrectionData = {
                    suggestionId: suggestion.id,
                    correctionType: 'ignore',
                    userNotes: 'Ignored by user'
                  };
                  handleSaveCorrection(correction);
                }}
                className="flex items-center gap-2"
                disabled={isLoading}
              >
                <XCircle className="w-4 h-4" />
                Ignore
              </Button>
            </div>
          )}

          {/* Feedback Status */}
          {suggestion.user_feedback !== 'pending' && (
            <div className="pt-2 border-t">
              <p className="text-sm text-gray-600">
                <strong>Status:</strong> {suggestion.user_feedback}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Correction Modal */}
      <CorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        suggestion={suggestion}
        onSaveCorrection={handleSaveCorrection}
      />
    </>
  );
}
