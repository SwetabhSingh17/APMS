import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProjectTopic, StudentGroup } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info, Lock, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Modal from "@/components/ui/modal";

type ApprovedTopicsResponse = {
  hasSelectedTopic: boolean;
  myTopic?: ProjectTopic;
  availableTopics: ProjectTopic[];
  takenTopics: ProjectTopic[];
};

export default function StudentTopics() {
  const { user } = useAuth();
  
  if (user?.course === "MCA") {
    return <McaStudentTopics />;
  }

  return <BcaStudentTopics />;
}

function BcaStudentTopics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allottedAlertOpen, setAllottedAlertOpen] = useState(false);

  // Fetch current user's team to check permission
  const { data: userGroup } = useQuery<StudentGroup & { myStatus: string }>({
    queryKey: ["/api/student-groups/my-group"],
    enabled: !!user,
    retry: false, // Don't retry if 404 (not in team)
  });

  // Fetch approved topics with categorization
  const { data: topicsData, isLoading: isLoadingTopics } = useQuery<ApprovedTopicsResponse>({
    queryKey: ["/api/topics/approved"],
    enabled: !!user
  });

  // Determine if user can select topic
  const isGroupMember = !!userGroup;
  const isCreator = userGroup?.createdById === user?.id;
  const isAcceptedMember = userGroup?.myStatus === 'accepted';

  let canSelect = true;
  let reason = "";

  if (isGroupMember) {
    if (!isAcceptedMember) {
      canSelect = false;
      reason = "You must accept the project team invite to select a topic.";
    } else if (!isCreator) {
      canSelect = false;
      reason = "Only the project team creator can select a project topic.";
    }
  }

  // If student has already selected a topic, they cannot select another
  if (topicsData?.hasSelectedTopic) {
    canSelect = false;
  }

  const selectTopicMutation = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await apiRequest("POST", "/api/projects", { topicId });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to select topic");
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Topic selected successfully",
        description: "You have successfully selected this project topic.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/my"] });
    },
    onError: (error: Error) => {
      console.error("Error selecting topic:", error);
      toast({
        title: "Failed to select topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSelectTopic = (topicId: number) => {
    if (!canSelect) return;
    selectTopicMutation.mutate(topicId);
  };

  if (isLoadingTopics) {
    return (
      <MainLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Available Topics</h1>
          <p className="text-muted-foreground">Loading topics...</p>
        </div>
        <TopicsSkeleton />
      </MainLayout>
    );
  }

  const hasSelected = topicsData?.hasSelectedTopic ?? false;
  const myTopic = topicsData?.myTopic;
  const availableTopics = topicsData?.availableTopics ?? [];
  const takenTopics = topicsData?.takenTopics ?? [];

  return (
    <MainLayout>
      {/* Scenario B: Student HAS selected a topic */}
      {hasSelected && myTopic ? (
        <>
          {/* Top Section: My Selected Topic */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">My Selected Topic</h1>
                <p className="text-muted-foreground">Your current project assignment</p>
              </div>
            </div>

            <TopicCard
              topic={myTopic}
              onSelect={() => { }}
              disabled={true}
              disabledReason="You have already selected this topic"
              isSelected={true}
            />
          </div>

          {/* Bottom Section: Other Topics (All greyed out) */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">Other Topics</h2>
              <p className="text-muted-foreground">You cannot select another topic</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...availableTopics, ...takenTopics].map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onSelect={() => { }}
                  disabled={true}
                  disabledReason="You have already selected a topic"
                  isGreyedOut={true}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Scenario A: Student has NOT selected a topic */
        <>
          {/* Top Section: Available Topics */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Available Topics</h1>
                <p className="text-muted-foreground">Select a project topic from the list below</p>
              </div>
              {!canSelect && isGroupMember && (
                <div className="bg-yellow-500/10 text-yellow-600 px-4 py-2 rounded-md border border-yellow-500/20 text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {reason}
                </div>
              )}
            </div>

            {availableTopics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableTopics.map(topic => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onSelect={() => handleSelectTopic(topic.id)}
                    disabled={!canSelect}
                    disabledReason={reason}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No available topics at the moment. All topics have been taken.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Bottom Section: Taken Topics (Greyed out) */}
          {takenTopics.length > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground mb-1">Taken Topics</h2>
                <p className="text-muted-foreground">These topics are already assigned to other students</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {takenTopics.map(topic => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onSelect={() => setAllottedAlertOpen(true)}
                    disabled={true}
                    disabledReason="This topic is already taken"
                    isGreyedOut={true}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={allottedAlertOpen} onOpenChange={setAllottedAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Topic Unavailable</AlertDialogTitle>
            <AlertDialogDescription>
              This topic is already allotted. To change your selection, please contact your coordinator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAllottedAlertOpen(false)}>Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function McaStudentTopics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);

  // Fetch current user's team
  const { data: userGroup, isLoading: isLoadingGroup } = useQuery<StudentGroup & { myStatus: string }>({
    queryKey: ["/api/student-groups/my-group"],
    enabled: !!user,
    retry: false, 
  });

  // Fetch suggested topics
  const { data: mySuggestions = [], isLoading: isLoadingSuggestions } = useQuery<ProjectTopic[]>({
    queryKey: ["/api/topics/my-suggestions"],
    enabled: !!user
  });

  const suggestTopicSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    technology: z.string().min(1, "Technology is required"),
    projectType: z.string().min(1, "Project Type is required"),
  });

  type SuggestTopicValues = z.infer<typeof suggestTopicSchema>;

  const form = useForm<SuggestTopicValues>({
    resolver: zodResolver(suggestTopicSchema),
    defaultValues: {
      title: "",
      description: "",
      technology: "",
      projectType: "Minor",
    }
  });

  const suggestTopicMutation = useMutation({
    mutationFn: async (data: SuggestTopicValues) => {
      const res = await apiRequest("POST", "/api/topics/suggest", data);
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Failed to suggest topic");
      }
      return resData;
    },
    onSuccess: () => {
      toast({
        title: "Topic suggested successfully",
        description: "Your supervisor will review the topic shortly.",
      });
      setIsSuggestModalOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/topics/my-suggestions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to suggest topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: SuggestTopicValues) => {
    suggestTopicMutation.mutate(data);
  };

  if (isLoadingGroup || isLoadingSuggestions) {
    return (
      <MainLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Suggest Topic</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <TopicsSkeleton />
      </MainLayout>
    );
  }

  const hasSupervisor = !!userGroup?.supervisorId;
  const isAcceptedMember = userGroup?.myStatus === 'accepted';
  const canSuggest = hasSupervisor && isAcceptedMember;

  return (
    <MainLayout>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Suggest Project Topic</h1>
            <p className="text-muted-foreground">Suggest topics for your supervisor to review.</p>
          </div>
          {canSuggest && (
            <Button onClick={() => setIsSuggestModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Suggest Topic
            </Button>
          )}
        </div>

        {!userGroup && (
          <Card className="bg-yellow-500/10 border-yellow-500/20 mb-6">
             <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-yellow-600">
                  <Lock className="h-5 w-5" />
                  <p>You must create or join a project team before suggesting a topic.</p>
                </div>
             </CardContent>
          </Card>
        )}

        {userGroup && !isAcceptedMember && (
          <Card className="bg-yellow-500/10 border-yellow-500/20 mb-6">
             <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-yellow-600">
                  <Lock className="h-5 w-5" />
                  <p>You must accept the project team invite to suggest a topic.</p>
                </div>
             </CardContent>
          </Card>
        )}

        {userGroup && isAcceptedMember && !hasSupervisor && (
          <Card className="bg-blue-500/10 border-blue-500/20 mb-6">
             <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-600">
                  <Info className="h-5 w-5" />
                  <p>Please wait for your Coordinator to assign a Supervisor to your team.</p>
                </div>
             </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mySuggestions.length === 0 ? (
             <Card className="col-span-full border-dashed shadow-none">
              <CardContent className="pt-6 text-center text-muted-foreground py-12">
                <p className="mb-4">You have not suggested any topics yet.</p>
                {canSuggest && (
                  <Button variant="outline" onClick={() => setIsSuggestModalOpen(true)}>
                    Suggest Your First Topic
                  </Button>
                )}
              </CardContent>
             </Card>
          ) : (
            mySuggestions.map(topic => (
              <Card key={topic.id}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-start gap-2">
                    <span>{topic.title}</span>
                    <BadgeForStatus status={topic.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Description:</p>
                      <p className="text-sm line-clamp-3">{topic.description}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Technology:</p>
                      <p className="text-sm">{topic.technology}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Modal isOpen={isSuggestModalOpen} onClose={() => setIsSuggestModalOpen(false)} title="Suggest New Topic">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Library Management System" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of the project" 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="technology"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technology</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g., React, Node.js" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Type</FormLabel>
                    <FormControl>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="Minor">Minor Project</option>
                        <option value="Major">Major Project</option>
                        <option value="Mini">Mini Project</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsSuggestModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={suggestTopicMutation.isPending}>
                {suggestTopicMutation.isPending ? "Submitting..." : "Submit Suggestion"}
              </Button>
            </div>
          </form>
        </Form>
      </Modal>
    </MainLayout>
  );
}

function BadgeForStatus({ status }: { status: string }) {
  if (status === 'pending_supervisor') {
    return <span className="text-xs font-normal px-2 py-1 bg-blue-500/10 text-blue-600 rounded-full whitespace-nowrap">Pending Supervisor</span>
  }
  if (status === 'pending') {
    return <span className="text-xs font-normal px-2 py-1 bg-yellow-500/10 text-yellow-600 rounded-full whitespace-nowrap">Pending Coordinator</span>
  }
  if (status === 'approved') {
    return <span className="text-xs font-normal px-2 py-1 bg-green-500/10 text-green-600 rounded-full whitespace-nowrap">Approved</span>
  }
  if (status === 'rejected') {
    return <span className="text-xs font-normal px-2 py-1 bg-destructive/10 text-destructive rounded-full whitespace-nowrap">Rejected</span>
  }
  return <span className="text-xs font-normal px-2 py-1 bg-gray-500/10 text-gray-600 rounded-full whitespace-nowrap">{status}</span>
}

interface TopicCardProps {
  topic: ProjectTopic;
  onSelect: () => void;
  disabled: boolean;
  disabledReason: string;
  isSelected?: boolean;
  isGreyedOut?: boolean;
}

function TopicCard({ topic, onSelect, disabled, disabledReason, isSelected = false, isGreyedOut = false }: TopicCardProps) {
  const cardClassName = isSelected
    ? "border-primary bg-primary/5"
    : isGreyedOut
      ? "opacity-50 cursor-not-allowed"
      : "";

  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle className="flex justify-between items-start gap-2">
          <span>{topic.title}</span>
          {isSelected ? (
            <span className="text-xs font-normal px-2 py-1 bg-primary text-primary-foreground rounded-full whitespace-nowrap">
              Selected
            </span>
          ) : isGreyedOut ? (
            <span className="text-xs font-normal px-2 py-1 bg-destructive/10 text-destructive rounded-full whitespace-nowrap">
              Taken
            </span>
          ) : (
            <span className="text-xs font-normal px-2 py-1 bg-green-500/10 text-green-600 rounded-full whitespace-nowrap">
              Available
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Description:</p>
            <p className="text-sm line-clamp-3">{topic.description}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Technology:</p>
            <p className="text-sm">{topic.technology}</p>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="w-full block">
                  <Button
                    onClick={onSelect}
                    className="w-full"
                    variant={isSelected || isGreyedOut ? "secondary" : "default"}
                    disabled={disabled || isGreyedOut}
                  >
                    {isSelected ? "Selected Topic" : isGreyedOut ? "Already Taken" : "Select Topic"}
                  </Button>
                </span>
              </TooltipTrigger>
              {disabled && !isGreyedOut && !isSelected && (
                <TooltipContent>
                  <p>{disabledReason}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
