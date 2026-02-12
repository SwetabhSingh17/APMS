import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";
import Modal from "@/components/ui/modal";
import { Search } from "lucide-react";

interface StudentProject {
  id: number;
  student: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    department: string;
  };
  topic: {
    id: number;
    title: string;
    description: string;
    technology: string;
    submittedById: number;
    submittedBy?: {
      id: number;
      firstName: string;
      lastName: string;
      department: string;
    };
  };
  progress: number;
  marks?: number;
  feedback?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TeacherEvaluations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<StudentProject | null>(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");

  // Fetch projects assigned to the teacher
  const { data: projects = [], isLoading } = useQuery<StudentProject[]>({
    queryKey: ["/api/projects/teacher"],
    enabled: !!user && user.role === UserRole.TEACHER,
    queryFn: async () => {
      console.log('Fetching teacher projects for user:', user);
      const response = await apiRequest("GET", "/api/projects/teacher");
      const data = await response.json();
      console.log('Received teacher projects:', data);
      return data;
    }
  });

  const evaluateMutation = useMutation({
    mutationFn: async ({ projectId, marks, feedback }: { projectId: number; marks: number; feedback: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/evaluate`, {
        marks,
        feedback
      });
      if (!response.ok) {
        throw new Error("Failed to evaluate project");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Evaluation submitted successfully",
        description: "The project has been evaluated.",
      });
      setIsEvaluationModalOpen(false);
      setSelectedProject(null);
      setMarks("");
      setFeedback("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects/teacher"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to evaluate project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEvaluate = (project: StudentProject) => {
    setSelectedProject(project);
    setMarks(project.marks?.toString() || "");
    setFeedback(project.feedback || "");
    setIsEvaluationModalOpen(true);
  };

  const handleSubmitEvaluation = () => {
    if (!selectedProject || !marks) return;

    const marksNumber = parseFloat(marks);
    if (isNaN(marksNumber) || marksNumber < 0 || marksNumber > 100) {
      toast({
        title: "Invalid marks",
        description: "Marks must be a number between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    evaluateMutation.mutate({
      projectId: selectedProject.id,
      marks: marksNumber,
      feedback: feedback
    });
  };

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(project => {
      const searchLower = searchQuery.toLowerCase();
      return (
        project.student.firstName.toLowerCase().includes(searchLower) ||
        project.student.lastName.toLowerCase().includes(searchLower) ||
        project.topic.title.toLowerCase().includes(searchLower) ||
        project.topic.technology.toLowerCase().includes(searchLower) ||
        project.student.department.toLowerCase().includes(searchLower)
      );
    });
  }, [projects, searchQuery]);

  if (!user || user.role !== UserRole.TEACHER) {
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
                This page is only accessible to teachers.
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
        <h1 className="text-2xl font-bold text-foreground mb-1">Student Evaluations</h1>
        <p className="text-muted-foreground">Evaluate and provide feedback for student projects</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by student name, email, or project title..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Project Title</TableHead>
                    <TableHead>Technology</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{project.student.firstName} {project.student.lastName}</p>
                            <p className="text-sm text-muted-foreground">{project.student.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{project.topic.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{project.topic.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{project.topic.technology}</TableCell>
                        <TableCell>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary rounded-full h-2" 
                              style={{ width: `${project.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-muted-foreground">{project.progress}%</span>
                        </TableCell>
                        <TableCell>
                          {project.marks !== undefined ? (
                            <span className="font-medium">{project.marks}/100</span>
                          ) : (
                            <span className="text-muted-foreground">Not evaluated</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEvaluate(project)}
                          >
                            Evaluate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchQuery 
                          ? "No projects match your search"
                          : "No projects assigned to evaluate"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evaluation Modal */}
      <Modal
        isOpen={isEvaluationModalOpen}
        onClose={() => {
          setIsEvaluationModalOpen(false);
          setSelectedProject(null);
          setMarks("");
          setFeedback("");
        }}
        title="Evaluate Project"
      >
        {selectedProject && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Project Details</h4>
              <p className="text-sm text-muted-foreground mb-1">
                Student: {selectedProject.student.firstName} {selectedProject.student.lastName}
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                Project: {selectedProject.topic.title}
              </p>
              <p className="text-sm text-muted-foreground">
                Progress: {selectedProject.progress}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marks">Marks (0-100)</Label>
              <Input
                id="marks"
                type="number"
                min="0"
                max="100"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="Enter marks"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback</Label>
              <textarea
                id="feedback"
                className="w-full min-h-[100px] p-2 border rounded-md"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Enter feedback for the student"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEvaluationModalOpen(false);
                  setSelectedProject(null);
                  setMarks("");
                  setFeedback("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitEvaluation}
                disabled={evaluateMutation.isPending}
              >
                {evaluateMutation.isPending ? "Submitting..." : "Submit Evaluation"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
} 