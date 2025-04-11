import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import TopicCard from "@/components/projects/topic-card";
import ProjectTable from "@/components/projects/project-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Modal from "@/components/ui/modal";
import { UserRole, ProjectTopic, InsertProjectTopic } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectTopicSchema } from "@shared/schema";
import { z } from "zod";

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ProjectTopic | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const { data: approvedTopics, isLoading: isLoadingTopics } = useQuery({
    queryKey: ["/api/topics/approved"],
    enabled: !!user
  });

  const { data: myTopics, isLoading: isLoadingMyTopics } = useQuery({
    queryKey: ["/api/topics/my"],
    enabled: !!user && user.role === UserRole.TEACHER
  });

  const { data: myProjects, isLoading: isLoadingMyProjects } = useQuery({
    queryKey: ["/api/projects/my"],
    enabled: !!user && user.role === UserRole.STUDENT
  });

  // Define form schema with additional validation
  const topicFormSchema = insertProjectTopicSchema.extend({
    estimatedComplexity: z.enum(["Low", "Medium", "High"])
  });

  type TopicFormValues = z.infer<typeof topicFormSchema>;

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      department: user?.department || "",
      estimatedComplexity: "Medium",
      submittedById: user?.id
    }
  });

  const submitTopicMutation = useMutation({
    mutationFn: async (data: InsertProjectTopic) => {
      const res = await apiRequest("POST", "/api/topics", data);
      return await res.json();
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

  const selectTopicMutation = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await apiRequest("POST", "/api/projects", { topicId });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic selected successfully",
        description: "You have successfully selected this project topic.",
      });
      setIsConfirmModalOpen(false);
      setSelectedTopic(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects/my"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to select topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: TopicFormValues) => {
    submitTopicMutation.mutate(data);
  };

  const handleSelectTopic = (topicId: number) => {
    const topic = approvedTopics?.find(t => t.id === topicId);
    if (topic) {
      setSelectedTopic(topic);
      setIsConfirmModalOpen(true);
    }
  };

  const confirmTopicSelection = () => {
    if (selectedTopic) {
      selectTopicMutation.mutate(selectedTopic.id);
    }
  };

  const renderTeacherContent = () => {
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Project Topics</h1>
            <p className="text-muted-foreground">Manage your submitted project topics</p>
          </div>
          <Button onClick={() => setIsSubmitModalOpen(true)}>Submit New Topic</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Your Submitted Topics</CardTitle>
            <CardDescription>
              Topics you have submitted for students to work on
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMyTopics ? (
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myTopics && myTopics.length > 0 ? (
                  myTopics.map(topic => (
                    <TopicCard key={topic.id} topic={topic} />
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    You haven't submitted any topics yet. Click "Submit New Topic" to get started.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  };

  const renderStudentContent = () => {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Project Selection</h1>
          <p className="text-muted-foreground">Browse and select from available project topics</p>
        </div>

        <Tabs defaultValue={myProjects && myProjects.length > 0 ? "myProject" : "availableTopics"}>
          <TabsList className="mb-4">
            <TabsTrigger value="availableTopics">Available Topics</TabsTrigger>
            <TabsTrigger value="myProject">My Project</TabsTrigger>
          </TabsList>
          
          <TabsContent value="availableTopics">
            <Card>
              <CardHeader>
                <CardTitle>Available Project Topics</CardTitle>
                <CardDescription>
                  Browse and select from faculty-approved project topics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTopics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array(6).fill(0).map((_, i) => (
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
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvedTopics && approvedTopics.length > 0 ? (
                      approvedTopics.map(topic => (
                        <TopicCard 
                          key={topic.id} 
                          topic={topic}
                          isStudent={true}
                          onSelect={handleSelectTopic}
                        />
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        No approved topics available yet. Please check back later.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="myProject">
            <Card>
              <CardHeader>
                <CardTitle>My Project</CardTitle>
                <CardDescription>
                  View details of your selected project
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingMyProjects ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <Skeleton className="h-20" />
                      <Skeleton className="h-20" />
                    </div>
                  </div>
                ) : (
                  myProjects && myProjects.length > 0 ? (
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{myProjects[0].topic.title}</h3>
                      <p className="text-muted-foreground mb-4">{myProjects[0].topic.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div>
                          <p className="text-sm text-muted-foreground">Department</p>
                          <p className="font-medium">{myProjects[0].topic.department}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Complexity</p>
                          <p className="font-medium">{myProjects[0].topic.estimatedComplexity}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Selected on</p>
                          <p className="font-medium">{new Date(myProjects[0].createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Progress</p>
                          <p className="font-medium">{myProjects[0].progress}%</p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-sm font-semibold mb-2">Progress</p>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary rounded-full h-2" 
                            style={{ width: `${myProjects[0].progress}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Next Milestone</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="font-medium">Research Documentation</p>
                            <p className="text-sm text-muted-foreground">Due in 7 days</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Faculty Mentor</CardTitle>
                          </CardHeader>
                          <CardContent className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-medium text-sm">
                                {myProjects[0].topic.submittedBy?.firstName?.charAt(0) || ""}
                                {myProjects[0].topic.submittedBy?.lastName?.charAt(0) || ""}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{myProjects[0].topic.submittedBy?.firstName} {myProjects[0].topic.submittedBy?.lastName}</p>
                              <p className="text-xs text-muted-foreground">{myProjects[0].topic.submittedBy?.department}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-4">You haven't selected a project topic yet.</p>
                      <Link href="/projects">
                        <Button variant="outline">Browse Available Topics</Button>
                      </Link>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </>
    );
  };

  const renderCoordinatorContent = () => {
    return (
      <>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Project Overview</h1>
          <p className="text-muted-foreground">View and manage all projects across departments</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>All Project Topics</CardTitle>
            <CardDescription>
              Overview of all project topics submitted by faculty
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="approved">
              <TabsList className="mb-4">
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
              
              <TabsContent value="approved">
                {isLoadingTopics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array(6).fill(0).map((_, i) => (
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
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvedTopics && approvedTopics.filter(t => t.status === 'approved').map(topic => (
                      <TopicCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="pending">
                {isLoadingTopics ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvedTopics && approvedTopics.filter(t => t.status === 'pending').map(topic => (
                      <TopicCard 
                        key={topic.id} 
                        topic={topic} 
                        isCoordinator={true} 
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="rejected">
                {isLoadingTopics ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvedTopics && approvedTopics.filter(t => t.status === 'rejected').map(topic => (
                      <TopicCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Student Projects</CardTitle>
            <CardDescription>
              All ongoing student projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMyProjects ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ProjectTable 
                projects={myProjects || []} 
                onViewDetails={(id) => console.log("View details", id)}
              />
            )}
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    <MainLayout>
      {user?.role === UserRole.TEACHER && renderTeacherContent()}
      {user?.role === UserRole.STUDENT && renderStudentContent()}
      {(user?.role === UserRole.COORDINATOR || user?.role === UserRole.ADMIN) && renderCoordinatorContent()}

      {/* Submit Topic Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit New Project Topic"
        description="Propose a new topic for students to work on"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Computer Science">Computer Science</SelectItem>
                        <SelectItem value="Information Technology">Information Technology</SelectItem>
                        <SelectItem value="Electronics Engineering">Electronics Engineering</SelectItem>
                        <SelectItem value="Mechanical Engineering">Mechanical Engineering</SelectItem>
                        <SelectItem value="Civil Engineering">Civil Engineering</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="estimatedComplexity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complexity</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select complexity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
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

      {/* Confirm Topic Selection Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setSelectedTopic(null);
        }}
        title="Confirm Topic Selection"
      >
        {selectedTopic && (
          <>
            <div className="mb-4">
              <h4 className="font-medium mb-2">{selectedTopic.title}</h4>
              <p className="text-sm text-muted-foreground">{selectedTopic.description}</p>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-1">
                Are you sure you want to select this topic? This action cannot be undone.
              </p>
              <p className="text-sm font-medium">
                You can only select one project topic per semester.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setSelectedTopic(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmTopicSelection}
                disabled={selectTopicMutation.isPending}
              >
                {selectTopicMutation.isPending ? "Selecting..." : "Confirm Selection"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </MainLayout>
  );
}
