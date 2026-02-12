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
import { UserRole, ProjectTopic, StudentProject, InsertProjectTopic, User } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectTopicSchema } from "@shared/schema";
import { z } from "zod";
import { Search } from "lucide-react";

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ProjectTopic | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<StudentProjectWithTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: approvedTopics = [], isLoading: isLoadingTopics } = useQuery<ProjectTopic[]>({
    queryKey: ["/api/topics/approved"],
    enabled: !!user
  });

  const { data: myTopics = [], isLoading: isLoadingMyTopics } = useQuery<ProjectTopic[]>({
    queryKey: ["/api/topics/my"],
    enabled: !!user && user.role === UserRole.TEACHER
  });

  type StudentProjectWithTopic = StudentProject & {
    topic: ProjectTopic | null;
    student: User;
    teacher?: User;
  };

  const { data: myProjects = [], isLoading: isLoadingMyProjects } = useQuery<StudentProjectWithTopic[]>({
    queryKey: ["/api/projects/my"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects/my");
      const data = await response.json();
      console.log('Projects data loaded:', data);
      return data;
    },
    enabled: !!user && user.role === UserRole.STUDENT
  });

  // Add new query for coordinator to fetch all projects
  const { data: allProjects = [], isLoading: isLoadingAllProjects } = useQuery<StudentProjectWithTopic[]>({
    queryKey: ["/api/projects/all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects");
      const data = await response.json();
      console.log('All projects loaded:', data);
      return data;
    },
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN || user.role === UserRole.TEACHER)
  });

  // Define form schema with additional validation
  const topicFormSchema = insertProjectTopicSchema.extend({
    technology: z.string().min(1, "Technology is required"),
    submittedById: z.number(),
    estimatedComplexity: z.number().min(1, "Estimated complexity is required")
  });

  type TopicFormValues = z.infer<typeof topicFormSchema>;

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      technology: "",
      submittedById: user?.id || 0,
      estimatedComplexity: 1
    }
  });

  const submitTopicMutation = useMutation({
    mutationFn: async (data: TopicFormValues) => {
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
    console.log("Form submitted with data:", data);
    try {
      submitTopicMutation.mutate(data);
    } catch (error) {
      console.error("Error submitting topic:", error);
    }
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

  const openDetailsModal = (projectId: number) => {
    const project = allProjects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setIsDetailsModalOpen(true);
    }
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedProject(null);
  };

  const filterProjects = (projects: StudentProjectWithTopic[]) => {
    if (!searchQuery) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(project =>
      project.topic?.title.toLowerCase().includes(query) ||
      (project.topic?.description?.toLowerCase().includes(query) || false) ||
      project.topic?.technology.toLowerCase().includes(query) ||
      project.student.firstName.toLowerCase().includes(query) ||
      project.student.lastName.toLowerCase().includes(query) ||
      project.student.email.toLowerCase().includes(query) ||
      (project.teacher?.firstName.toLowerCase().includes(query) || false) ||
      (project.teacher?.lastName.toLowerCase().includes(query) || false)
    );
  };

  const renderTeacherContent = () => {
    console.log("All Projects:", allProjects);
    console.log("Current User:", user);

    const teacherProjects = allProjects.filter(project => {
      console.log("Checking project:", {
        projectId: project.id,
        topicId: project.topic?.id,
        topicSubmittedById: project.topic?.submittedById,
        currentUserId: user?.id,
        hasMatch: project.topic?.submittedById === user?.id
      });
      return project.topic?.submittedById === user?.id;
    });

    console.log("Filtered Teacher Projects:", teacherProjects);

    const filteredProjects = filterProjects(teacherProjects);

    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">My Projects</h1>
            <p className="text-muted-foreground">Projects selected by students from your topics</p>
          </div>
          <Button onClick={() => setIsSubmitModalOpen(true)}>Submit New Topic</Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search projects by title, student, technology..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoadingAllProjects ? (
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <ProjectTable
            projects={filteredProjects}
            onViewDetails={openDetailsModal}
          />
        )}
      </>
    );
  };

  const renderStudentContent = () => {
    if (isLoadingMyProjects) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading your project...</p>
        </div>
      );
    }

    if (!myProjects || myProjects.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No projects found.</p>
        </div>
      );
    }

    const project = myProjects[0];
    if (!project.topic) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Project topic not found. Please contact your administrator.</p>
        </div>
      );
    }

    return (
      <div>
        <h3 className="text-xl font-semibold mb-2">{project.topic.title}</h3>
        <p className="text-muted-foreground mb-4">{project.topic.description}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Technology</p>
            <p className="font-medium">{project.topic.technology}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Selected on</p>
            <p className="font-medium">{new Date(project.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="font-medium">{project.progress}%</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Progress</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2"
              style={{ width: `${project.progress}%` }}
            ></div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Next Milestone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">Research Documentation</p>
              <p className="text-sm text-muted-foreground">Due in 7 days</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faculty Mentor</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-medium text-sm">
                  {project.topic.submittedBy?.firstName?.charAt(0) || ""}
                  {project.topic.submittedBy?.lastName?.charAt(0) || ""}
                </span>
              </div>
              <div>
                <p className="font-medium">{project.topic.submittedBy?.firstName} {project.topic.submittedBy?.lastName}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderCoordinatorContent = () => {
    const filteredProjects = filterProjects(allProjects);

    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">All Projects</h1>
            <p className="text-muted-foreground">Overview of all student projects</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search projects by title, student, teacher, technology..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoadingAllProjects ? (
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <ProjectTable
            projects={filteredProjects}
            onViewDetails={openDetailsModal}
          />
        )}
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
        <div className="bg-background/95 backdrop-blur-sm rounded-lg">
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
                        value={field.value || ""}
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
                      <Input placeholder="Enter technology" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedComplexity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Complexity (1-5)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        placeholder="Enter complexity (1-5)"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
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
        </div>
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
        <div className="bg-background/95 backdrop-blur-sm rounded-lg">
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
        </div>
      </Modal>

      {/* Project Details Modal */}
      {isDetailsModalOpen && selectedProject && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={closeDetailsModal}
          title="Project Details"
          description="Detailed information about the selected project"
        >
          <div className="bg-background/95 backdrop-blur-sm rounded-lg">
            <div className="space-y-6">
              <div className="space-y-2 bg-card/50 p-4 rounded-lg backdrop-blur-sm">
                <h3 className="text-lg font-semibold">{selectedProject.topic?.title || 'Unknown Topic'}</h3>
                <p className="text-sm text-muted-foreground">{selectedProject.topic?.description || 'No description available'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card/50 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-sm font-medium">Student</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProject.student ? `${selectedProject.student.firstName} ${selectedProject.student.lastName}` : 'Unknown Student'}
                  </p>
                </div>
                <div className="bg-card/50 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-sm font-medium">Start Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedProject.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-card/50 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-sm font-medium">Technology</p>
                  <p className="text-sm text-muted-foreground">{selectedProject.topic?.technology || 'Unknown'}</p>
                </div>
              </div>

              <div className="bg-card/50 p-4 rounded-lg backdrop-blur-sm">
                <p className="text-sm font-medium mb-2">Overall Progress</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full bg-muted/50 rounded-full h-2">
                      <div
                        className="bg-primary/80 rounded-full h-2"
                        style={{ width: `${selectedProject.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{selectedProject.progress}%</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDetailsModal}>Close</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}
