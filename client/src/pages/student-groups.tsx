import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { StudentSelect } from "@/components/student-select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, StudentGroup } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, UserPlus, Users, Info, Check, X } from "lucide-react";

// Create group form schema
const createGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  supervisorId: z.number(),
  enrollmentNumbers: z.array(z.string().min(1, "Enrollment number is required"))
    .min(2, "You need at least 2 other students to form a group")
    .max(4, "Maximum 4 other students can be added"),
});

// Join group form schema
const joinGroupSchema = z.object({
  groupId: z.number(),
});

type CreateGroupFormValues = z.infer<typeof createGroupSchema>;
type JoinGroupFormValues = z.infer<typeof joinGroupSchema>;

export default function StudentGroups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openInfoDialog, setOpenInfoDialog] = useState(false);
  const [enrollmentNumbers, setEnrollmentNumbers] = useState<string[]>([]);

  // Fetch supervisors for supervisor selection
  const { data: supervisors, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["/api/supervisors"],
    queryFn: async () => {
      const res = await fetch("/api/supervisors");
      if (!res.ok) throw new Error("Failed to fetch supervisors");
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch current user's group if they're in one
  const { data: userGroup, isLoading: isLoadingUserGroup } = useQuery({
    queryKey: ["/api/student-groups/my-group"],
    queryFn: async () => {
      const res = await fetch("/api/student-groups/my-group");
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch user group");
      }
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch all available groups
  const { data: availableGroups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["/api/student-groups"],
    queryFn: async () => {
      const res = await fetch("/api/student-groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: !!user && !userGroup,
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: CreateGroupFormValues) => {
      const res = await apiRequest("POST", "/api/student-groups", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Group created",
        description: "Your project team has been created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/my-group"] });
      setEnrollmentNumbers([]);
    },
    onError: (error) => {
      toast({
        title: "Failed to create group",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  // Accept Invite Mutation
  const acceptInviteMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await apiRequest("POST", `/api/groups/invite/${groupId}/accept`, {});
      if (!res.ok) throw new Error("Failed to accept invite");
    },
    onSuccess: () => {
      toast({
        title: "Invite Accepted",
        description: "You have successfully joined the group.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/my-group"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to accept invite",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Reject Invite Mutation
  const rejectInviteMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await apiRequest("POST", `/api/groups/invite/${groupId}/reject`, {});
      if (!res.ok) throw new Error("Failed to reject invite");
    },
    onSuccess: () => {
      toast({
        title: "Invite Rejected",
        description: "You have rejected the group invitation.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/my-group"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to reject invite",
        description: error.message,
        variant: "destructive",
      });
    }
  });


  // Create group form
  const createGroupForm = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      supervisorId: 0,
      enrollmentNumbers: [],
    },
  });

  const onCreateGroupSubmit = (data: CreateGroupFormValues) => {
    createGroupMutation.mutate({
      ...data,
      enrollmentNumbers: [...enrollmentNumbers, user?.enrollmentNumber || ""],
      // Filter out user's own enrollment number in case it was added manually? 
      // User's own enrollmentNumber is added here, checking user input validation is already done by UI and backend.
    });
  };




  // --- Student View ---
  if (isLoadingUserGroup) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading project team information...</span>
        </div>
      </MainLayout>
    );
  }

  // Handle pending invite view
  if (userGroup && userGroup.myStatus === 'pending') {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 max-w-3xl">
          <Card className="border-primary/50 shadow-lg">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center gap-2 text-primary">
                <Info className="h-5 w-5" />
                <span className="font-semibold">Team Invitation</span>
              </div>
              <CardTitle className="text-2xl mt-4">You have been invited to join "{userGroup.name}"</CardTitle>
              <CardDescription>{userGroup.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                {userGroup.supervisor ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="font-semibold text-lg text-primary">
                        {userGroup.supervisor?.firstName?.[0]}{userGroup.supervisor?.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Supervisor</p>
                      <p className="font-semibold text-lg">
                        {userGroup.supervisor?.prefix ? `${userGroup.supervisor.prefix} ` : ""}
                        {userGroup.supervisor?.firstName} {userGroup.supervisor?.lastName}
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Supervisor</p>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10">Not Assigned</Badge>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Current Members
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {userGroup.members?.map((member: User) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                      <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center text-xs font-semibold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div className="text-sm">
                        <p className="font-medium">{member.firstName} {member.lastName}</p>
                        <p className="text-muted-foreground text-xs">{member.enrollmentNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-4 justify-end border-t bg-muted/20 p-6">
              <Button
                variant="outline"
                className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => rejectInviteMutation.mutate(userGroup.id)}
                disabled={rejectInviteMutation.isPending}
              >
                {rejectInviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Reject Invitation
              </Button>
              <Button
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => acceptInviteMutation.mutate(userGroup.id)}
                disabled={acceptInviteMutation.isPending}
              >
                {acceptInviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Accept Invitation
              </Button>
            </CardFooter>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Project Teams</h1>

          {/* Info Dialog for Available Project Teams */}
          <Dialog open={openInfoDialog} onOpenChange={setOpenInfoDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2"
              >
                <Info className="h-4 w-4" />
                Available Project Teams Info
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Available Project Teams</DialogTitle>
                <DialogDescription>
                  View details about existing project teams and their members
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {isLoadingGroups ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : availableGroups?.length > 0 ? (
                  availableGroups.map((group: any) => (
                    <Card key={group.id}>
                      <CardHeader>
                        <CardTitle>{group.name}</CardTitle>
                        <CardDescription>{group.description}</CardDescription>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {group.members?.length || 0} / {group.maxSize} Members
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-semibold mb-4">Team Members</h3>
                            <div className="grid gap-4">
                              {group.members?.map((member: User) => (
                                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                      <span className="font-semibold">
                                        {member.firstName[0]}{member.lastName[0]}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {member.firstName} {member.lastName}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {member.enrollmentNumber}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <h3 className="font-semibold mb-4">Supervisor</h3>
                            <div className="flex items-center gap-4 p-4 border rounded-lg">
                              {group.supervisor ? (
                                <>
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="font-semibold">
                                      {group.supervisor?.firstName?.[0]}{group.supervisor?.lastName?.[0]}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {group.supervisor?.prefix ? `${group.supervisor.prefix} ` : ""}
                                      {group.supervisor?.firstName} {group.supervisor?.lastName}
                                    </p>
                                    {group.supervisor?.department && (
                                      <p className="text-sm text-muted-foreground">
                                        {group.supervisor.department}
                                      </p>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div>
                                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10">Not Assigned</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No project teams available at the moment
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {userGroup ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{userGroup.name}</CardTitle>
                <CardDescription>{userGroup.description}</CardDescription>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {userGroup.members?.length || 0} / {userGroup.maxSize} Members
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Team Members Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Members
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {userGroup.members?.map((member: User) => (
                        <div key={member.id} className="border rounded-lg p-4 bg-card/50">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="font-semibold text-lg">
                                {member.firstName[0]}{member.lastName[0]}
                              </span>
                            </div>
                            <div className="flex-1 space-y-1">
                              <h3 className="font-semibold">
                                {member.firstName} {member.lastName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {member.enrollmentNumber}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Supervisor Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Supervisor
                    </h3>
                    {userGroup.supervisor ? (
                      <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="font-semibold text-primary">
                              {userGroup.supervisor?.firstName?.[0]}{userGroup.supervisor?.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-lg">
                              {userGroup.supervisor?.prefix ? `${userGroup.supervisor.prefix} ` : ""}
                              {userGroup.supervisor?.firstName} {userGroup.supervisor?.lastName}
                            </p>
                            {userGroup.supervisor?.department && (
                              <p className="text-sm text-muted-foreground">
                                {userGroup.supervisor?.department}
                              </p>
                            )}
                            {userGroup.supervisor?.email && (
                              <p className="text-sm text-muted-foreground">
                                {userGroup.supervisor?.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-dashed rounded-lg p-5 bg-muted/30">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Supervisor</span>
                              <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs">
                                Not Assigned
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              No supervisor has been assigned to your project team yet. Your coordinator will assign a supervisor shortly, or one will be assigned automatically upon project topic selection.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t p-6">
                <div className="text-sm text-muted-foreground">
                  Project Team ID: #{userGroup.id}
                </div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {userGroup.course ? `${userGroup.course} Cohort` : "Project Team"}
                </Badge>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
              <p className="text-yellow-600 font-medium flex items-center justify-center gap-2">
                <Info className="h-5 w-5" />
                Create a Project Team to View group Info
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Create New Project Team</CardTitle>
                <CardDescription>
                  Create a new project team with a minimum of 3 and maximum of 5 members.
                  A supervisor will be assigned to guide your project.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...createGroupForm}>
                  <form onSubmit={createGroupForm.handleSubmit(onCreateGroupSubmit)} className="space-y-6">
                    <FormField
                      control={createGroupForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter group name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createGroupForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter group description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createGroupForm.control}
                      name="supervisorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supervisor</FormLabel>
                          <Select onValueChange={(value) => field.onChange(Number(value))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a supervisor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {supervisors?.map((supervisor: User) => (
                                <SelectItem key={supervisor.id} value={supervisor.id.toString()}>
                                  {supervisor.firstName} {supervisor.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormLabel>Add Team Members</FormLabel>
                      <StudentSelect
                        selectedEnrollments={enrollmentNumbers}
                        onChange={setEnrollmentNumbers}
                        courseFilter={user?.course || undefined}
                        maxSelections={user?.course === "BCA" ? 4 : (user?.course === "MCA" ? 1 : 4)}
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      Create Project Team
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}