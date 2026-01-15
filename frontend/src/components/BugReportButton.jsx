import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bug, X } from "lucide-react";
import { useAuth } from "@/App";
import axios from "axios";
import { toast } from "sonner";

export const BugReportButton = () => {
  const { user, API, getAuthHeaders } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    steps_to_reproduce: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim() || !formData.steps_to_reproduce.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/bug-reports`,
        formData,
        {
          withCredentials: true,
          headers: headers
        }
      );
      toast.success("Bug report submitted! If marked as valid, you'll earn trade points.");
      setFormData({ title: "", description: "", steps_to_reproduce: "" });
      setIsOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg bg-indigo-600 hover:bg-indigo-700"
        size="icon"
      >
        <Bug className="w-6 h-6" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Report a Bug
            </DialogTitle>
            <DialogDescription>
              Help us improve SwapFlow! If your bug report is marked as valid by an admin, you'll earn <strong>1 trade point</strong> as a reward.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Bug Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the bug"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">What is the bug? *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what the bug is and what happens..."
                className="min-h-[100px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="steps">Steps to Reproduce *</Label>
              <Textarea
                id="steps"
                value={formData.steps_to_reproduce}
                onChange={(e) => setFormData({ ...formData, steps_to_reproduce: e.target.value })}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                className="min-h-[120px] font-mono text-sm"
                required
              />
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-sm text-indigo-900">
                <strong>💡 Tip:</strong> The more detailed your report, the easier it is for us to fix it. Include what you expected to happen vs. what actually happened.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
