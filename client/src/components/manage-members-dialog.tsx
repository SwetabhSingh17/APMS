import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StudentSelect } from "./student-select";

export function ManageMembersDialog({ group, open, onOpenChange }: { group: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [enrollmentNumbers, setEnrollmentNumbers] = useState<string[]>(group?.members?.map((m: any) => m.enrollmentNumber) || []);

  // Update on prop change
  import { useEffect } from "react";
  useEffect(() => {
    if (open && group) {
      setEnrollmentNumbers(group.members?.map((m: any) => m.enrollmentNumber) || []);
    }
  }, [open, group]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/student-groups/${group.id}/members`, { enrollmentNumbers });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Members Updated", description: "The team members have been successfully updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/all"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Members - {group.name}</DialogTitle>
          <DialogDescription>Add or remove members for this project team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <StudentSelect 
            selectedEnrollments={enrollmentNumbers}
            onChange={setEnrollmentNumbers}
            courseFilter={group.course}
            maxSelections={group.course === "BCA" ? 5 : 2}
          />

          <Button 
            className="w-full mt-4" 
            onClick={() => updateMutation.mutate()} 
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Members
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
