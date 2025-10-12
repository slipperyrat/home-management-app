'use client';

import { useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function CorrectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    setFeedback('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correction Review</DialogTitle>
          <DialogDescription>Thank you for sharing feedback on AI results.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            rows={4}
            placeholder="Leave optional notes for the team"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
