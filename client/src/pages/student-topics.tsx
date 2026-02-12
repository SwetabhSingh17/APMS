import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProjectTopic, StudentGroup } from "@shared/schema";
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
import { Info, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ApprovedTopicsResponse = {
  hasSelectedTopic: boolean;
  myTopic?: ProjectTopic;
  availableTopics: ProjectTopic[];
  takenTopics: ProjectTopic[];
};

export default function StudentTopics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allottedAlertOpen, setAllottedAlertOpen] = useState(false);

  // Fetch current user's group to check permission
  const { data: userGroup } = useQuery<StudentGroup & { myStatus: string }>({
    queryKey: ["/api/student-groups/my-group"],
    enabled: !!user,
    retry: false, // Don't retry if 404 (not in group)
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
      reason = "You must accept the group invite to select a topic.";
    } else if (!isCreator) {
      canSelect = false;
      reason = "Only the group creator can select a project topic.";
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