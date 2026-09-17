import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProjectTopic, StudentGroup, User } from "@shared/schema";
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
import { Info, Lock, Plus, Search, ChevronDown, ChevronUp, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Modal from "@/components/ui/modal";

export interface IApprovedTopicsResponse {
  hasSelectedTopic: boolean;
  myTopic?: ProjectTopic;
  availableTopics: ProjectTopic[];
  takenTopics: ProjectTopic[];
}

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
  // State for topic selection confirmation popup
  const [selectedTopicForConfirm, setSelectedTopicForConfirm] = useState<ProjectTopic | null>(null);
  const [confirmAlertOpen, setConfirmAlertOpen] = useState(false);

  // Fetch current user's team to check permission
  const { data: userGroup } = useQuery<StudentGroup & { myStatus: string }>({
    queryKey: ["/api/student-groups/my-group"],
    enabled: !!user,
    retry: false, // Don't retry if 404 (not in team)
  });

  // Fetch approved topics with categorization
  const { data: topicsData, isLoading: isLoadingTopics } = useQuery<IApprovedTopicsResponse | ProjectTopic[]>({
    queryKey: ["/api/topics/approved", "student"],
    queryFn: async () => {
      const res = await fetch("/api/topics/approved", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch topics");
      return res.json();
    },
    enabled: !!user
  });

  // Determine if user can select topic
  const isGroupMember = !!userGroup;
  const isAcceptedMember = userGroup?.myStatus === 'accepted';
  const creatorIsStudentMember = (userGroup as any)?.members?.some((m: any) => m.id === userGroup?.createdById);
  const isCreator = userGroup?.createdById === user?.id;

  let canSelect = true;
  let reason = "";

  if (isGroupMember) {
    if (!isAcceptedMember) {
      canSelect = false;
      reason = "You must accept the project team invite to select a topic.";
    } else if (creatorIsStudentMember && !isCreator) {
      canSelect = false;
      reason = "Only the project team creator can select a project topic.";
    }
  }

  // If student has already selected a topic, they cannot select another
  const isArray = Array.isArray(topicsData);
  const hasSelectedTopicCheck = !isArray && Boolean((topicsData as IApprovedTopicsResponse)?.hasSelectedTopic);
  if (hasSelectedTopicCheck) {
    canSelect = false;
  }

  const selectTopicMutation = useMutation({
    mutationFn: async (topicId: number) => {
      // Use raw fetch instead of apiRequest to handle error body parsing ourselves
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
        credentials: "include",
      });
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
      // Invalidate queries across topics, projects, and student groups so all views update
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/topics') ||
            key.startsWith('/api/projects') ||
            key.startsWith('/api/student-groups')
          );
        },
      });
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

    // Find the topic to show its title in the confirmation dialog
    const topic = availableTopics.find(t => t.id === topicId) ||
                  (Array.isArray(topicsData) ? (topicsData as ProjectTopic[]) : (topicsData as IApprovedTopicsResponse)?.availableTopics ?? []).find(t => t.id === topicId);

    if (topic) {
      setSelectedTopicForConfirm(topic as ProjectTopic);
      setConfirmAlertOpen(true);
    }
  };

  /** Called when user confirms topic selection in the dialog */
  const confirmTopicSelection = () => {
    if (selectedTopicForConfirm) {
      selectTopicMutation.mutate(selectedTopicForConfirm.id);
      setConfirmAlertOpen(false);
      setSelectedTopicForConfirm(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "available" | "unavailable">("all");

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

  const availableTopics = isArray ? (topicsData as ProjectTopic[]) : ((topicsData as IApprovedTopicsResponse)?.availableTopics ?? []);
  const takenTopics = isArray ? [] : ((topicsData as IApprovedTopicsResponse)?.takenTopics ?? []);
  const myTopic = isArray ? undefined : (topicsData as IApprovedTopicsResponse)?.myTopic;
  const hasSelected = isArray ? false : ((topicsData as IApprovedTopicsResponse)?.hasSelectedTopic ?? false);

  // Apply search query filtering across topic attributes
  const filterBySearch = (list: ProjectTopic[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) || false) ||
      (t.technology?.toLowerCase().includes(q) || false) ||
      (t.topicCode?.toLowerCase().includes(q) || false)
    );
  };

  const filteredAvailable = filterBySearch(availableTopics);
  const filteredTaken = filterBySearch(takenTopics);

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Project Topics</h1>
          <p className="text-muted-foreground mt-1">
            Browse available and allocated project topics for your course
          </p>
        </div>
        {!canSelect && isGroupMember && (
          <div className="bg-yellow-500/10 text-yellow-600 px-4 py-2 rounded-md border border-yellow-500/20 text-sm font-medium flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{reason}</span>
          </div>
        )}
      </div>

      {/* Featured Banner: My Selected Topic (if selected) */}
      {hasSelected && myTopic && (
        <div className="mb-8 p-6 rounded-xl bg-primary/5 border-2 border-primary/30 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Your Selected Project Topic</h2>
            </div>
            <Link href="/projects">
              <Button size="sm" className="gap-2 shadow-xs">
                View Project Progress & Details
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <TopicCard
            topic={myTopic}
            onSelect={() => {}}
            disabled={true}
            disabledReason="You have already selected this topic"
            isSelected={true}
          />
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search topics by title, PUGID code (e.g. PUGID26001), technology..."
              className="pl-10 w-full"
              aria-label="Search topics"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tab Filters */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
          <TabsList className="grid grid-cols-3 max-w-md w-full">
            <TabsTrigger value="all" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span>All Topics</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
                {filteredAvailable.length + filteredTaken.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="available" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span>Available</span>
              <Badge variant="outline" className="px-1.5 py-0 text-[11px] border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/10">
                {filteredAvailable.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unavailable" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span>Unavailable</span>
              <Badge variant="outline" className="px-1.5 py-0 text-[11px] border-destructive/30 text-destructive bg-destructive/10">
                {filteredTaken.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Topics Display based on activeTab */}
      {activeTab === "all" && (
        <div className="space-y-8">
          {/* Available Section */}
          {filteredAvailable.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  Available Topics ({filteredAvailable.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAvailable.map(topic => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onSelect={() => handleSelectTopic(topic.id)}
                    disabled={!canSelect}
                    disabledReason={reason || (hasSelected ? "You have already selected a project topic" : "")}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unavailable / Taken Section */}
          {filteredTaken.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive"></span>
                  Unavailable / Taken Topics ({filteredTaken.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTaken.map(topic => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onSelect={() => setAllottedAlertOpen(true)}
                    disabled={true}
                    disabledReason="This topic is already allotted to another team"
                    isUnavailable={true}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredAvailable.length === 0 && filteredTaken.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-lg font-medium text-foreground mb-1">No topics found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? `No topics match "${searchQuery}". Try refining your search.` : "No project topics available."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "available" && (
        <div>
          {filteredAvailable.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAvailable.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onSelect={() => handleSelectTopic(topic.id)}
                  disabled={!canSelect}
                  disabledReason={reason || (hasSelected ? "You have already selected a project topic" : "")}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-lg font-medium text-foreground mb-1">No available topics found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? `No available topics match "${searchQuery}".` : "All project topics have been allotted."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "unavailable" && (
        <div>
          {filteredTaken.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTaken.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onSelect={() => setAllottedAlertOpen(true)}
                  disabled={true}
                  disabledReason="This topic is already allotted to another team"
                  isUnavailable={true}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-lg font-medium text-foreground mb-1">No unavailable topics found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? `No taken topics match "${searchQuery}".` : "No topics are currently marked as taken."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={allottedAlertOpen} onOpenChange={setAllottedAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Topic Unavailable</AlertDialogTitle>
            <AlertDialogDescription>
              This topic has already been selected by another student or team. To change your selection, please contact your coordinator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAllottedAlertOpen(false)}>Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation popup when a student selects a topic */}
      <AlertDialog open={confirmAlertOpen} onOpenChange={(open) => {
        setConfirmAlertOpen(open);
        if (!open) setSelectedTopicForConfirm(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Project Selection</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to select{" "}
                  <strong className="text-foreground">"{selectedTopicForConfirm?.title}"</strong>{" "}
                  as your project topic.
                </p>
                <p>
                  This project will be allotted to your <strong className="text-foreground">entire project team</strong>.
                </p>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-destructive font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    This action cannot be changed or reversed.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  In case of any issue or query, kindly contact your Department's Project Coordinator.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmAlertOpen(false);
              setSelectedTopicForConfirm(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmTopicSelection}
              disabled={selectTopicMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {selectTopicMutation.isPending ? "Selecting..." : "Confirm Selection"}
            </AlertDialogAction>
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
              <McaSuggestionCard key={topic.id} topic={topic} />
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

function McaSuggestionCard({ topic }: { topic: ProjectTopic }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isExpanded ? "ring-2 ring-primary/30 shadow-md" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <CardHeader>
        <CardTitle className="flex justify-between items-start gap-2">
          <span>{topic.title}</span>
          <BadgeForStatus status={topic.status} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Description:</p>
            <p className={`text-sm transition-all duration-200 ${
              isExpanded ? "whitespace-pre-line text-foreground/90 leading-relaxed" : "line-clamp-3 text-muted-foreground"
            }`}>
              {topic.description || "No description provided."}
            </p>
            {topic.description && topic.description.length > 100 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1 mt-1.5 focus:outline-none"
              >
                {isExpanded ? (
                  <>
                    <span>Show less</span>
                    <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    <span>Read full description</span>
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Technology:</p>
            <p className="text-sm font-medium">{topic.technology}</p>
          </div>
        </div>
      </CardContent>
    </Card>
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

interface ITopicCardProps {
  topic: ProjectTopic;
  onSelect: () => void;
  disabled: boolean;
  disabledReason: string;
  isSelected?: boolean;
  isUnavailable?: boolean;
  isGreyedOut?: boolean;
}

function TopicCard({
  topic,
  onSelect,
  disabled,
  disabledReason,
  isSelected = false,
  isUnavailable = false,
  isGreyedOut = false,
}: ITopicCardProps) {
  // State for toggling between clamped summary view and full unabridged description
  const [isExpanded, setIsExpanded] = useState(false);
  const unavailable = isUnavailable || isGreyedOut;

  const cardClassName = isSelected
    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
    : unavailable
      ? "border-border/60 bg-muted/20 opacity-80"
      : "hover:border-primary/40 hover:shadow-sm";

  return (
    <Card 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`h-full flex flex-col cursor-pointer transition-all duration-200 ${cardClassName} ${
        isExpanded ? "ring-2 ring-primary/30 shadow-md" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {topic.topicCode && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {topic.topicCode}
            </span>
          )}
          {topic.course && (
            <span className="px-2 py-0.5 bg-accent/10 text-accent text-[11px] rounded-full border border-accent/20 font-medium">
              {topic.course}
            </span>
          )}
          {topic.projectType && (
            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[11px] rounded-full font-medium">
              {topic.projectType}
            </span>
          )}
        </div>
        <CardTitle className="flex justify-between items-start gap-2 text-base md:text-lg leading-tight">
          <span>{topic.title}</span>
          {isSelected ? (
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-primary text-primary-foreground rounded-full whitespace-nowrap shadow-2xs">
              Selected
            </span>
          ) : unavailable ? (
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-full whitespace-nowrap">
              Unavailable / Taken
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 rounded-full whitespace-nowrap">
              Available
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-grow flex flex-col justify-between pt-0">
        <div className="space-y-3">
          {/* Description Section with Click to Expand */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Description</p>
            <p className={`text-sm text-foreground/90 transition-all duration-200 ${
              isExpanded ? "whitespace-pre-line leading-relaxed" : "line-clamp-3 text-muted-foreground"
            }`}>
              {topic.description || "No description provided."}
            </p>
            {topic.description && topic.description.length > 100 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1 mt-1.5 focus:outline-none"
              >
                {isExpanded ? (
                  <>
                    <span>Show less</span>
                    <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    <span>Read full description</span>
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Technology & Metadata */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
            <div>
              <p className="text-muted-foreground">Technology</p>
              <p className="font-medium line-clamp-1">{topic.technology || "General"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Complexity</p>
              <p className="font-medium">{topic.estimatedComplexity || "Medium"}</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 mt-auto">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="w-full block">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect();
                    }}
                    className="w-full"
                    variant={isSelected ? "secondary" : unavailable ? "outline" : "default"}
                    disabled={disabled || unavailable || isSelected}
                  >
                    {isSelected ? "Your Selected Topic" : unavailable ? "Already Taken" : "Select Topic"}
                  </Button>
                </span>
              </TooltipTrigger>
              {disabled && !unavailable && !isSelected && (
                <TooltipContent>
                  <p>{disabledReason}</p>
                </TooltipContent>
              )}
              {unavailable && (
                <TooltipContent>
                  <p>This project topic has already been allotted to another student or team.</p>
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
