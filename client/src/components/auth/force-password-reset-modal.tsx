import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, KeyRound, Eye, EyeOff, ShieldAlert, CheckCircle2 } from "lucide-react";

/**
 * Interface for the forced password reset form state
 */
interface IForcePasswordResetForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Non-dismissible modal intercepting student session on first login.
 * Requires updating the initial password (enrollment number) before granting portal access.
 */
export function ForcePasswordResetModal() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState<IForcePasswordResetForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Only display to authenticated students who have the forced password reset flag active
  const shouldOpen = Boolean(user && user.role === "student" && user.forcePasswordReset);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Validate current password presence
    if (!formData.currentPassword) {
      setErrorMessage("Please enter your current password (your enrollment number).");
      return;
    }

    // Validate minimum password length
    if (!formData.newPassword || formData.newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }

    // Ensure new password differs from initial password
    if (formData.currentPassword === formData.newPassword) {
      setErrorMessage("New password cannot be the same as your initial enrollment number password.");
      return;
    }

    // Validate password confirmation match
    if (formData.newPassword !== formData.confirmPassword) {
      setErrorMessage("New password and confirmation do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call protected change password endpoint
      const response = await apiRequest("POST", "/api/user/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update password.");
      }

      // Update TanStack Query user cache to unlock UI
      if (user) {
        queryClient.setQueryData(["/api/user"], {
          ...user,
          forcePasswordReset: false,
        });
      }

      toast({
        title: "Password Updated Successfully",
        description: "Welcome to APMS. Your account is now secured.",
      });

      // Clear form
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Could not update password.");
      toast({
        title: "Password Update Failed",
        description: err.message || "Please check the entered credentials.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shouldOpen) return null;

  return (
    <Dialog open={shouldOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-bold text-center text-foreground">
            Mandatory Password Reset
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Per institutional security policy, you must replace your temporary initial password before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-600 dark:text-amber-400 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Initial Login Credential:</span> Your default current password is your <strong>enrollment number ({user?.enrollmentNumber})</strong>.
          </div>
        </div>

        {errorMessage && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="current-pwd" className="text-xs font-semibold text-foreground">
              Current Password (Enrollment Number)
            </Label>
            <div className="relative">
              <Input
                id="current-pwd"
                type={showCurrent ? "text" : "password"}
                placeholder="Enter your enrollment number"
                value={formData.currentPassword}
                onChange={(e) => setFormData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                className="pr-10 bg-background/50 border-input"
                disabled={isSubmitting}
                autoFocus
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd" className="text-xs font-semibold text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-pwd"
                type={showNew ? "text" : "password"}
                placeholder="At least 6 characters"
                value={formData.newPassword}
                onChange={(e) => setFormData((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="pr-10 bg-background/50 border-input"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd" className="text-xs font-semibold text-foreground">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-pwd"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your new password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="pr-10 bg-background/50 border-input"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Save New Password</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
