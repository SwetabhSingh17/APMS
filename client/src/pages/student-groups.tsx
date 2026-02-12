import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User, StudentGroup } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, UserPlus, Users, UserX, Info, Check, X } from "lucide-react";

// Create group form schema
const createGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  facultyId: z.number(),
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
  const [openLeaveDialog, setOpenLeaveDialog] = useState(false);
  const [openInfoDialog, setOpenInfoDialog] = useState(false);
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [enrollmentNumbers, setEnrollmentNumbers] = useState<string[]>([]);

  // Fetch teachers for faculty selection
  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["/api/teachers"],
    queryFn: async () => {
      const res = await fetch("/api/teachers");
      if (!res.ok) throw new Error("Failed to fetch teachers");
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
        description: "Your student group has been created successfully!",
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

  // Leave group mutation
  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      if (!userGroup) throw new Error("You are not in a group");
      const res = await apiRequest("POST", `/api/student-groups/${userGroup.id}/leave`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Group left",
        description: "You have left the group successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/my-group"] });
      setOpenLeaveDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to leave group",
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
      facultyId: 0,
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

  const handleLeaveGroup = () => {
    leaveGroupMutation.mutate();
  };

  const addEnrollmentNumber = () => {
    if (enrollmentNumber && !enrollmentNumbers.includes(enrollmentNumber)) {
      setEnrollmentNumbers([...enrollmentNumbers, enrollmentNumber]);
      setEnrollmentNumber("");
    }
  };

  const removeEnrollmentNumber = (number: string) => {
    setEnrollmentNumbers(enrollmentNumbers.filter(n => n !== number));
  };

  if (isLoadingUserGroup) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading group information...</span>
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
                <span className="font-semibold">Group Invitation</span>
              </div>
              <CardTitle className="text-2xl mt-4">You have been invited to join "{userGroup.name}"</CardTitle>
              <CardDescription>{userGroup.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-semibold text-lg text-primary">
                    {userGroup.faculty?.firstName[0]}{userGroup.faculty?.lastName[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Proposed Project Mentor</p>
                  <p className="font-semibold text-lg">
                    {userGroup.faculty?.firstName} {userGroup.faculty?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{userGroup.faculty?.department}</p>
                </div>
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
          <h1 className="text-3xl font-bold">Student Groups</h1>

          {/* Info Dialog for Available Groups */}
          <Dialog open={openInfoDialog} onOpenChange={setOpenInfoDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2"
              >
                <Info className="h-4 w-4" />
                Available Groups Info
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Available Groups</DialogTitle>
                <DialogDescription>
                  View details about existing student groups and their members
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {isLoadingGroups ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : availableGroups?.length > 0 ? (
                  availableGroups.map((group: StudentGroup) => (
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
                            <h3 className="font-semibold mb-4">Group Members</h3>
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
                            <h3 className="font-semibold mb-4">Project Mentor</h3>
                            <div className="flex items-center gap-4 p-4 border rounded-lg">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="font-semibold">
                                  {group.faculty?.firstName[0]}{group.faculty?.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">
                                  {group.faculty?.firstName} {group.faculty?.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {group.faculty?.department}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No groups available at the moment
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
                  {/* Group Members Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Group Members
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

                  {/* Faculty Mentor Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Project Mentor
                    </h3>
                    <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-semibold text-primary">
                            {userGroup.faculty?.firstName[0]}{userGroup.faculty?.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-lg">
                            {userGroup.faculty?.firstName} {userGroup.faculty?.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {userGroup.faculty?.department}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {userGroup.faculty?.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t p-6">
                <div className="text-sm text-muted-foreground">
                  Project Group ID: #{userGroup.id}
                </div>
                <AlertDialog open={openLeaveDialog} onOpenChange={setOpenLeaveDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">Leave Group</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. You will be removed from the group.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeaveGroup}>Leave Group</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
              <p className="text-yellow-600 font-medium flex items-center justify-center gap-2">
                <Info className="h-5 w-5" />
                Create a Group to View group Info
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Create New Group</CardTitle>
                <CardDescription>
                  Create a new student group with a minimum of 3 and maximum of 5 members.
                  A faculty member will be assigned as your project mentor.
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
                          <FormLabel>Group Name</FormLabel>
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
                      name="facultyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Mentor</FormLabel>
                          <Select onValueChange={(value) => field.onChange(Number(value))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a faculty member" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teachers?.map((teacher: User) => (
                                <SelectItem key={teacher.id} value={teacher.id.toString()}>
                                  {teacher.firstName} {teacher.lastName} - {teacher.department}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormLabel>Add Group Members</FormLabel>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter enrollment number"
                          value={enrollmentNumber}
                          onChange={(e) => setEnrollmentNumber(e.target.value)}
                        />
                        <Button type="button" onClick={addEnrollmentNumber}>
                          Add
                        </Button>
                      </div>

                      {enrollmentNumbers.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Added members ({enrollmentNumbers.length}/4)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {enrollmentNumbers.map((number) => (
                              <Badge key={number} variant="secondary" className="flex items-center gap-1">
                                {number}
                                <button
                                  type="button"
                                  onClick={() => removeEnrollmentNumber(number)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <UserX className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full">
                      Create Group
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