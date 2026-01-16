import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const REPORT_CATEGORIES = [
  "Inappropriate Content",
  "Scam/Fraud",
  "Item Not as Described",
  "Harassment",
  "Spam",
  "Other"
];

export const ReportDialog = ({ isOpen, onOpenChange, reportType, reportedItemId, reportedUserId, reportedTradeId }) => {
  const { API, getAuthHeaders } = useAuth();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!category.trim() || !description.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/reports`,
        {
          report_type: reportType,
          reported_item_id: reportedItemId || null,
          reported_user_id: reportedUserId || null,
          reported_trade_id: reportedTradeId || null,
          category: category.trim(),
          description: description.trim(),
        },
        { withCredentials: true, headers: headers }
      );
      toast.success("Report submitted successfully. Thank you for helping keep SwapFlow safe.");
      onOpenChange(false);
      setCategory("");
      setDescription("");
    } catch (error) {
      console.error("Failed to submit report:", error);
      toast.error(error.response?.data?.detail || "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setCategory("");
      setDescription("");
    }
  };

  const getReportTypeLabel = () => {
    switch (reportType) {
      case "item":
        return "Item";
      case "user":
        return "User";
      case "trade":
        return "Trade";
      default:
        return "Content";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Report {getReportTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            Help us keep SwapFlow safe by reporting inappropriate content or behavior.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Reason for Reporting *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="bg-slate-50">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details about why you are reporting this..."
              className="min-h-[120px] bg-slate-50"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} type="button" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 spinner" />
                  Submitting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
