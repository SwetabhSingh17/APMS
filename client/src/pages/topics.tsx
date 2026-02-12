import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Modal from "@/components/ui/modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProjectTopic, UserRole, insertProjectTopicSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

export default function Topics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ProjectTopic | null>(null);

  // Check URL parameters for auto-opening submit modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'submit') {
      setIsSubmitModalOpen(true);
      // Clean up the URL
      window.history.replaceState({}, '', '/topics');
    }
  }, []);

  // Fetch all topics submitted by the teacher
  const { data: myTopics = [], isLoading: isLoadingMyTopics } = useQuery<ProjectTopic[]>({
    queryKey: ["/api/topics/my"],
    enabled: !!user && user.role === UserRole.TEACHER
  });

  // Form schema
  const topicFormSchema = insertProjectTopicSchema.extend({
    technology: z.string().min(1, "Technology is required"),
    projectType: z.string().min(1, "Project Type is required"),
    submittedById: z.number(),
  });

  type TopicFormValues = z.infer<typeof topicFormSchema>;

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      technology: "",
      projectType: "",
      submittedById: user?.id || 0,
    }
  });

  const editForm = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      technology: "",
      projectType: "",
      submittedById: user?.id || 0,
    }
  });

  const submitTopicMutation = useMutation({
    mutationFn: async (data: TopicFormValues) => {
      const res = await apiRequest("POST", "/api/topics", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic submitted successfully",
        description: "Your project topic has been submitted for approval.",
      });
      form.reset();
      setIsSubmitModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/topics/my"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateTopicMutation = useMutation({
    mutationFn: async (data: TopicFormValues) => {
      if (!selectedTopic) return;
      const res = await apiRequest("PUT", `/api/topics/${selectedTopic.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic updated successfully",
        description: "Your project topic has been updated.",
      });
      editForm.reset();
      setIsEditModalOpen(false);
      setSelectedTopic(null);
      queryClient.invalidateQueries({ queryKey: ["/api/topics/my"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/topics/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete topic");
      }
    },
    onSuccess: () => {
      toast({
        title: "Topic deleted successfully",
        description: "The project topic has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/my"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleDeleteTopic = (id: number) => {
    if (window.confirm("Are you sure you want to delete this topic? This action cannot be undone.")) {
      deleteTopicMutation.mutate(id);
    }
  };

  const onSubmit = (data: TopicFormValues) => {
    console.log("Form submitted with data:", data);
    try {
      submitTopicMutation.mutate(data);
    } catch (error) {
      console.error("Error submitting topic:", error);
    }
  };

  const onEditSubmit = (data: TopicFormValues) => {
    updateTopicMutation.mutate(data);
  };

  // Update edit form when selected topic changes
  useEffect(() => {
    if (selectedTopic) {
      editForm.reset({
        title: selectedTopic.title,
        description: selectedTopic.description,
        technology: selectedTopic.technology,
        projectType: selectedTopic.projectType,
        submittedById: user?.id || 0,
      });
    }
  }, [selectedTopic, editForm, user?.id]);

  // Filter topics by status
  const pendingTopics = myTopics.filter(topic => topic.status === "pending");
  const approvedTopics = myTopics.filter(topic => topic.status === "approved");
  const rejectedTopics = myTopics.filter(topic => topic.status === "rejected");

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">My Topics</h1>
          <p className="text-muted-foreground">Manage your submitted project topics</p>
        </div>
        <Button onClick={() => setIsSubmitModalOpen(true)}>Submit New Topic</Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Topics</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingTopics.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approvedTopics.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejectedTopics.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoadingMyTopics ? (
            <TopicsSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTopics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onDelete={handleDeleteTopic}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onEdit={() => {
                  setSelectedTopic(topic);
                  setIsEditModalOpen(true);
                }}
                onDelete={handleDeleteTopic}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onDelete={handleDeleteTopic}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rejectedTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onDelete={handleDeleteTopic}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit Topic Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit New Project Topic"
        description="Propose a new topic for students to work on"
      >
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Form submit event triggered");
              const values = form.getValues();
              console.log("Form values:", values);
              submitTopicMutation.mutate(values);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter the project topic title" {...field} />
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
                      placeholder="Provide a detailed description of the project topic"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="technology"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Technology</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter the technologies to be used in this project"
                      {...field}
                    />
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
                    <Input
                      placeholder="e.g., Web Development, Mobile App, Data Science, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitTopicMutation.isPending}
              >
                {submitTopicMutation.isPending ? "Submitting..." : "Submit Topic"}
              </Button>
            </div>
          </form>
        </Form>
      </Modal>

      {/* Edit Topic Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Project Topic"
        description="Update your project topic details"
      >
        <Form {...editForm}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Edit form submit event triggered");
              const values = editForm.getValues();
              console.log("Edit form values:", values);
              if (selectedTopic) {
                updateTopicMutation.mutate(values);
              }
            }}
            className="space-y-4"
          >
            <FormField
              control={editForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter the project topic title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a detailed description of the project topic"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
              name="technology"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Technology</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter the technologies to be used in this project"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
              name="projectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Web Development, Mobile App, Data Science, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateTopicMutation.isPending}
              >
                {updateTopicMutation.isPending ? "Updating..." : "Update Topic"}
              </Button>
            </div>
          </form>
        </Form>
      </Modal>
    </MainLayout>
  );
}

type TopicCardProps = {
  topic: ProjectTopic;
  onEdit?: () => void;
  onDelete: (id: number) => void;
};

function TopicCard({ topic, onEdit, onDelete }: TopicCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{topic.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground mb-4">{topic.description}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Technology</p>
            <p className="font-medium">{topic.technology}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <div>
              {topic.status === 'pending' && (
                <span className="px-2 py-1 bg-accent/20 text-accent-foreground text-xs rounded-full">Pending</span>
              )}
              {topic.status === 'approved' && (
                <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs rounded-full">Approved</span>
              )}
              {topic.status === 'rejected' && (
                <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs rounded-full">Rejected</span>
              )}
            </div>
          </div>
          {topic.feedback && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Feedback</p>
              <p className="font-medium">{topic.feedback}</p>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {topic.status === 'pending' && onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onEdit}
            >
              Edit Topic
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDelete(topic.id)}
          >
            Delete Topic
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array(3).fill(0).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-3/4 mb-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 