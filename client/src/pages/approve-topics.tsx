import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UseQueryOptions } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Modal from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Search, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProjectTopic, UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export default function ApproveTopics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTopic, setSelectedTopic] = useState<ProjectTopic | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set());
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: pendingTopics = [], isLoading } = useQuery<ProjectTopic[]>({
    queryKey: ["/api/topics/pending"],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN),
    onSuccess: (data: ProjectTopic[]) => {
      console.log('Received pending topics:', data);
    }
  } as UseQueryOptions<ProjectTopic[]>);

  const { data: approvedTopics = [], isLoading: isLoadingApproved } = useQuery<ProjectTopic[]>({
    queryKey: ["/api/topics/approved"],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN),
    onSuccess: (data: ProjectTopic[]) => {
      console.log('Received approved topics:', data);
    }
  } as UseQueryOptions<ProjectTopic[]>);

  const { data: rejectedTopics = [], isLoading: isLoadingRejected } = useQuery<ProjectTopic[]>({
    queryKey: ["/api/topics/rejected"],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN),
    onSuccess: (data: ProjectTopic[]) => {
      console.log('Received rejected topics:', data);
    }
  } as UseQueryOptions<ProjectTopic[]>);

  const approveMutation = useMutation({
    mutationFn: async (topicId: number) => {
      await apiRequest("POST", `/api/topics/${topicId}/approve`, { feedback });
    },
    onSuccess: () => {
      toast({
        title: "Topic approved successfully",
        description: "The topic has been approved and is now available for students to select.",
      });
      closeTopicModal();
      queryClient.invalidateQueries({ queryKey: ["/api/topics/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/approved"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to approve topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (topicId: number) => {
      await apiRequest("POST", `/api/topics/${topicId}/reject`, { feedback });
    },
    onSuccess: () => {
      toast({
        title: "Topic rejected",
        description: "The topic has been rejected.",
      });
      closeTopicModal();
      queryClient.invalidateQueries({ queryKey: ["/api/topics/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/rejected"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reject topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (topicIds: number[]) => {
      await Promise.all(
        topicIds.map(id => apiRequest("DELETE", `/api/topics/${id}`))
      );
    },
    onSuccess: () => {
      toast({
        title: "Topics deleted successfully",
        description: "The selected topics have been deleted.",
      });
      setSelectedTopics(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/topics/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/approved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/rejected"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete topics",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const openTopicModal = (topic: ProjectTopic) => {
    setSelectedTopic(topic);
    setFeedback("");
    setIsTopicModalOpen(true);
  };

  const closeTopicModal = () => {
    setIsTopicModalOpen(false);
    setSelectedTopic(null);
    setFeedback("");
  };

  const handleApprove = () => {
    if (selectedTopic) {
      approveMutation.mutate(selectedTopic.id);
    }
  };

  const handleReject = () => {
    if (selectedTopic) {
      rejectMutation.mutate(selectedTopic.id);
    }
  };

  const handleTopicSelect = (topicId: number, checked: boolean) => {
    const newSelected = new Set(selectedTopics);
    if (checked) {
      newSelected.add(topicId);
    } else {
      newSelected.delete(topicId);
    }
    setSelectedTopics(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedTopics.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedTopics.size} selected topic(s)? This action cannot be undone.`)) {
      deleteMutation.mutate(Array.from(selectedTopics));
    }
  };

  const filterTopics = (topics: ProjectTopic[]) => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return topics.filter(
        topic =>
          topic.title.toLowerCase().includes(query) ||
          topic.description?.toLowerCase().includes(query)
      );
    }
    return topics;
  };

  const filteredPending = filterTopics(pendingTopics);
  const filteredApproved = filterTopics(approvedTopics);
  const filteredRejected = filterTopics(rejectedTopics);

  if (!user || (user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                This page is only accessible to coordinators and administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Topic Approval</h1>
        <p className="text-muted-foreground">Review and manage project topics submitted by faculty members</p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search topics by title or description..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {selectedTopics.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedTopics.size})
          </Button>
        )}
      </div>

      <Card>
        <Tabs defaultValue="pending">
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Pending
                {pendingTopics && <span className="ml-2 text-xs px-2 py-1 bg-accent/20 text-accent-foreground rounded-full">{filteredPending.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved
                {approvedTopics && <span className="ml-2 text-xs px-2 py-1 bg-secondary/20 text-secondary rounded-full">{filteredApproved.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected
                {rejectedTopics && <span className="ml-2 text-xs px-2 py-1 bg-destructive/20 text-destructive rounded-full">{filteredRejected.length}</span>}
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            <TabsContent value="pending">
              {isLoading ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-96" />
                      </div>
                      <Skeleton className="h-10 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={filteredPending.length > 0 && selectedTopics.size === filteredPending.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTopics(new Set(filteredPending.map(t => t.id)));
                              } else {
                                setSelectedTopics(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPending.length > 0 ? (
                        filteredPending.map((topic) => (
                          <TableRow key={topic.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Checkbox
                                checked={selectedTopics.has(topic.id)}
                                onCheckedChange={(checked) => handleTopicSelect(topic.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{topic.title}</p>
                                <p className="text-sm text-muted-foreground">{(topic.description || "").substring(0, 60)}...</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                                  <span className="text-secondary font-medium text-sm">
                                    {topic.submittedBy?.firstName?.charAt(0)}
                                    {topic.submittedBy?.lastName?.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p>{topic.submittedBy?.firstName} {topic.submittedBy?.lastName}</p>
                                  {/* <p className="text-xs text-muted-foreground">{topic.submittedBy?.department}</p> */}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(topic.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex space-x-2 justify-end">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-secondary hover:bg-secondary/90"
                                  onClick={() => openTopicModal(topic)}
                                >
                                  Review
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {searchQuery
                              ? "No pending topics match your filters"
                              : "No pending topics to approve"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved">
              {isLoadingApproved ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={filteredApproved.length > 0 && selectedTopics.size === filteredApproved.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTopics(new Set(filteredApproved.map(t => t.id)));
                              } else {
                                setSelectedTopics(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date Approved</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApproved.length > 0 ? (
                        filteredApproved.map((topic) => (
                          <TableRow key={topic.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Checkbox
                                checked={selectedTopics.has(topic.id)}
                                onCheckedChange={(checked) => handleTopicSelect(topic.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{topic.title}</p>
                                <p className="text-sm text-muted-foreground">{(topic.description || "").substring(0, 60)}...</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                                  <span className="text-secondary font-medium text-sm">
                                    {topic.submittedBy?.firstName?.charAt(0)}
                                    {topic.submittedBy?.lastName?.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p>{topic.submittedBy?.firstName} {topic.submittedBy?.lastName}</p>
                                  {/* <p className="text-xs text-muted-foreground">{topic.submittedBy?.department}</p> */}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                                <CheckCircle className="mr-1 h-3 w-3" /> Approved
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(topic.updatedAt || topic.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (window.confirm("Are you sure you want to delete this topic?")) {
                                    deleteMutation.mutate([topic.id]);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {searchQuery
                              ? "No approved topics match your filters"
                              : "No approved topics yet"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {isLoadingRejected ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={filteredRejected.length > 0 && selectedTopics.size === filteredRejected.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTopics(new Set(filteredRejected.map(t => t.id)));
                              } else {
                                setSelectedTopics(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Feedback</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRejected.length > 0 ? (
                        filteredRejected.map((topic) => (
                          <TableRow key={topic.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Checkbox
                                checked={selectedTopics.has(topic.id)}
                                onCheckedChange={(checked) => handleTopicSelect(topic.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{topic.title}</p>
                                <p className="text-sm text-muted-foreground">{(topic.description || "").substring(0, 60)}...</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                                  <span className="text-secondary font-medium text-sm">
                                    {topic.submittedBy?.firstName?.charAt(0)}
                                    {topic.submittedBy?.lastName?.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p>{topic.submittedBy?.firstName} {topic.submittedBy?.lastName}</p>
                                  {/* <p className="text-xs text-muted-foreground">{topic.submittedBy?.department}</p> */}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                                <XCircle className="mr-1 h-3 w-3" /> Rejected
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {topic.feedback || "No feedback provided"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (window.confirm("Are you sure you want to delete this topic?")) {
                                    deleteMutation.mutate([topic.id]);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {searchQuery
                              ? "No rejected topics match your filters"
                              : "No rejected topics"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Review Topic Modal */}
      <Modal
        isOpen={isTopicModalOpen}
        onClose={closeTopicModal}
        title="Review Project Topic"
      >
        {selectedTopic && (
          <>
            <div className="mb-4">
              <h4 className="font-medium mb-2">{selectedTopic.title}</h4>
              <p className="text-sm text-muted-foreground">{selectedTopic.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Submitted By</p>
                <p className="font-medium">
                  {selectedTopic.submittedBy?.firstName} {selectedTopic.submittedBy?.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Technology</p>
                <p className="font-medium">{selectedTopic.technology}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date Submitted</p>
                <p className="font-medium">
                  {new Date(selectedTopic.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <Label htmlFor="feedback" className="block text-sm font-medium mb-1">Feedback (optional)</Label>
              <Textarea
                id="feedback"
                rows={3}
                className="w-full text-sm"
                placeholder="Add any feedback or suggestions..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            <div className="flex space-x-3 justify-end">
              <Button
                variant="outline"
                onClick={closeTopicModal}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectMutation.isPending || approveMutation.isPending}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Reject Topic"}
              </Button>
              <Button
                variant="default"
                className="bg-secondary hover:bg-secondary/90"
                onClick={handleApprove}
                disabled={rejectMutation.isPending || approveMutation.isPending}
              >
                {approveMutation.isPending ? "Approving..." : "Approve Topic"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </MainLayout>
  );
}
