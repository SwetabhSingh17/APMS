import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StudentSelect } from "./student-select";

const createGroupSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  supervisorId: z.string().optional(),
  enrollmentNumbers: z.array(z.string().min(1, "Enrollment number is required")).min(1, "At least one member is required")
});

type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

export function CreateTeamDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [enrollmentNumbers, setEnrollmentNumbers] = useState<string[]>([]);

  // Fetch all supervisors
  const { data: supervisors } = useQuery({
    queryKey: ["/api/supervisors"],
    queryFn: async () => {
      const res = await fetch("/api/supervisors");
      if (!res.ok) throw new Error("Failed to fetch supervisors");
      return res.json();
    },
  });

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      supervisorId: "none",
      enrollmentNumbers: [],
    },
  });

  // Keep form values in sync with local state array
  useEffect(() => {
    form.setValue("enrollmentNumbers", enrollmentNumbers);
  }, [enrollmentNumbers, form]);

  const createGroupMutation = useMutation({
    mutationFn: async (data: CreateGroupFormValues) => {
      const payload: any = {
        name: data.name,
        description: data.description,
        enrollmentNumbers: data.enrollmentNumbers,
      };
      if (data.supervisorId && data.supervisorId !== "none" && data.supervisorId.trim() !== "") {
        payload.supervisorId = parseInt(data.supervisorId);
      }
      const res = await apiRequest("POST", "/api/student-groups", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Project Team Created", description: "The team was successfully created." });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (
            key.startsWith("/api/student-groups") ||
            key.startsWith("/api/students")
          );
        },
      });
      setOpen(false);
      form.reset({
        name: "",
        description: "",
        supervisorId: "none",
        enrollmentNumbers: [],
      });
      setEnrollmentNumbers([]);
    },
    onError: (error) => {
      toast({ title: "Failed to create team", description: error.message, variant: "destructive" });
    },
  });

  const addEnrollmentNumber = () => {
    if (enrollmentNumber && !enrollmentNumbers.includes(enrollmentNumber)) {
      setEnrollmentNumbers([...enrollmentNumbers, enrollmentNumber]);
      setEnrollmentNumber("");
    }
  };

  const removeEnrollmentNumber = (number: string) => {
    setEnrollmentNumbers(enrollmentNumbers.filter(n => n !== number));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Create Project Team</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Project Team</DialogTitle>
          <DialogDescription>Create a new project team for students.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createGroupMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl><Input placeholder="Enter team name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Description</FormLabel>
                  <FormControl><Textarea placeholder="Describe the team's project focus..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supervisorId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Assign Supervisor</FormLabel>
                    <span className="text-xs text-muted-foreground font-normal">Optional</span>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a supervisor (Optional)" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None (Allotted after topic selection)</SelectItem>
                      {supervisors?.map((sup: any) => (
                        <SelectItem key={sup.id} value={sup.id.toString()}>
                          {sup.prefix ? `${sup.prefix} ` : ""}{sup.firstName} {sup.lastName} ({sup.department || sup.designation || "Faculty"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Optional: The supervisor is automatically allotted to the team after they select their project topic.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Add Team Members</FormLabel>
              <StudentSelect
                selectedEnrollments={enrollmentNumbers}
                onChange={setEnrollmentNumbers}
                maxSelections={5}
              />
            </div>

            <Button type="submit" className="w-full" disabled={createGroupMutation.isPending}>
              {createGroupMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Project Team
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
