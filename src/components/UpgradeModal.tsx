import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl">Upgrade to Pro</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground mb-4">
          This feature is only available on the Pro plan.
        </p>
        <Button asChild className="w-full">
          <a href="/upgrade">Upgrade Now</a>
        </Button>
        <Button variant="ghost" className="w-full mt-2" onClick={onClose}>
          Not Now
        </Button>
      </DialogContent>
    </Dialog>
  );
} 