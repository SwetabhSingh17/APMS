import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CollaborationType, InsertStudentGroup, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, UserPlus, Users, UserX } from "lucide-react";

// Create group form schema
const createGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  collaborationType: z.nativeEnum(CollaborationType),
  facultyId: z.number().optional().nullable(),
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
  
  // Fetch teachers for faculty collaboration option
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
  
  // Fetch available groups
  const { data: availableGroups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["/api/student-groups/available"],
    queryFn: async () => {
      const res = await fetch("/api/student-groups/available");
      if (!res.ok) throw new Error("Failed to fetch available groups");
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
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/available"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create group",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Join group mutation
  const joinGroupMutation = useMutation({
    mutationFn: async (data: JoinGroupFormValues) => {
      const res = await apiRequest("POST", `/api/student-groups/${data.groupId}/join`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Group joined",
        description: "You have successfully joined the group!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/my-group"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/available"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to join group",
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
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/available"] });
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
  
  // Create group form
  const createGroupForm = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      collaborationType: CollaborationType.STUDENT_GROUP,
      facultyId: null,
    },
  });
  
  // Join group form
  const joinGroupForm = useForm<JoinGroupFormValues>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: {
      groupId: 0,
    },
  });
  
  const onCreateGroupSubmit = (data: CreateGroupFormValues) => {
    createGroupMutation.mutate(data);
  };
  
  const onJoinGroupSubmit = (data: JoinGroupFormValues) => {
    joinGroupMutation.mutate(data);
  };
  
  const handleLeaveGroup = () => {
    leaveGroupMutation.mutate();
  };
  
  const watchCollaborationType = createGroupForm.watch("collaborationType");
  
  if (isLoadingUserGroup) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading group information...</span>
      </div>
    );
  }
  
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Student Groups</h1>
          <p className="text-muted-foreground">Create or join a group for project collaboration</p>
        </div>
      </div>
      
      {userGroup ? (
        // User is already in a group
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{userGroup.name}</CardTitle>
                <CardDescription>
                  Collaboration Type: {userGroup.collaborationType === CollaborationType.STUDENT_GROUP 
                    ? "Student Group" 
                    : "Faculty Collaboration"}
                </CardDescription>
              </div>
              <AlertDialog open={openLeaveDialog} onOpenChange={setOpenLeaveDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    <UserX className="h-4 w-4" />
                    Leave Group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove you from the group. Any projects associated with this group may be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleLeaveGroup}
                      disabled={leaveGroupMutation.isPending}
                    >
                      {leaveGroupMutation.isPending ? "Leaving..." : "Leave Group"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Description</h3>
                <p className="text-muted-foreground mt-1">{userGroup.description}</p>
              </div>
              
              {userGroup.collaborationType === CollaborationType.FACULTY_COLLABORATION && userGroup.faculty && (
                <div>
                  <h3 className="font-medium">Faculty Mentor</h3>
                  <div className="flex items-center mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                      <span className="font-semibold">{userGroup.faculty.firstName[0]}{userGroup.faculty.lastName[0]}</span>
                    </div>
                    <div>
                      <p>{userGroup.faculty.firstName} {userGroup.faculty.lastName}</p>
                      <p className="text-xs text-muted-foreground">{userGroup.faculty.email}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <h3 className="font-medium">Group Members</h3>
                <div className="space-y-2 mt-2">
                  {userGroup.members?.map((member: User) => (
                    <div key={member.id} className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center mr-2">
                        <span className="font-semibold">{member.firstName[0]}{member.lastName[0]}</span>
                      </div>
                      <div>
                        <p>{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        // User is not in a group
        <Tabs defaultValue="create">
          <TabsList className="mb-6">
            <TabsTrigger value="create">Create Group</TabsTrigger>
            <TabsTrigger value="join">Join Group</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create a New Group</CardTitle>
                <CardDescription>
                  Create a new group with 3-5 members for your project collaboration
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
                          <FormDescription>
                            Choose a name that reflects your project focus or team identity
                          </FormDescription>
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
                            <Textarea 
                              placeholder="Describe your group and its project focus" 
                              className="min-h-[100px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createGroupForm.control}
                      name="collaborationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Collaboration Type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value={CollaborationType.STUDENT_GROUP} />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Student Group (3-5 students)
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value={CollaborationType.FACULTY_COLLABORATION} />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Faculty Collaboration (Work with a faculty member)
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {watchCollaborationType === CollaborationType.FACULTY_COLLABORATION && (
                      <FormField
                        control={createGroupForm.control}
                        name="facultyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Faculty</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))} 
                              defaultValue={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a faculty member" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {isLoadingTeachers ? (
                                  <div className="flex items-center justify-center p-2">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    <span>Loading...</span>
                                  </div>
                                ) : (
                                  teachers?.map((teacher: User) => (
                                    <SelectItem key={teacher.id} value={teacher.id.toString()}>
                                      {teacher.firstName} {teacher.lastName}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The faculty member will be notified and can accept or decline the collaboration
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createGroupMutation.isPending}
                    >
                      {createGroupMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                          Creating Group...
                        </>
                      ) : (
                        "Create Group"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>Join an Existing Group</CardTitle>
                <CardDescription>
                  Join an existing group that has space for new members
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingGroups ? (
                  <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading available groups...</span>
                  </div>
                ) : availableGroups?.length ? (
                  <div className="space-y-4">
                    {availableGroups.map((group: any) => (
                      <Card key={group.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{group.name}</CardTitle>
                              <CardDescription>
                                {group.members.length} / {group.maxSize} members
                              </CardDescription>
                            </div>
                            <Badge variant={group.collaborationType === CollaborationType.STUDENT_GROUP ? "default" : "secondary"}>
                              {group.collaborationType === CollaborationType.STUDENT_GROUP ? "Student Group" : "Faculty Collaboration"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                          
                          {group.collaborationType === CollaborationType.FACULTY_COLLABORATION && group.faculty && (
                            <div className="mt-2">
                              <span className="text-xs font-medium">Faculty: </span>
                              <span className="text-xs">{group.faculty.firstName} {group.faculty.lastName}</span>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex justify-between pt-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              joinGroupForm.setValue("groupId", group.id);
                              joinGroupMutation.mutate({ groupId: group.id });
                            }}
                            disabled={joinGroupMutation.isPending}
                          >
                            <UserPlus className="h-4 w-4" />
                            {joinGroupMutation.isPending && joinGroupForm.getValues("groupId") === group.id 
                              ? "Joining..." 
                              : "Join Group"
                            }
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <h3 className="text-lg font-medium">No groups available</h3>
                    <p className="text-muted-foreground">
                      There are no groups available to join at the moment.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => document.querySelector('[data-value="create"]')?.click()}
                    >
                      Create a New Group
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}