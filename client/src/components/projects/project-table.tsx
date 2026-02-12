import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProjectTopic, StudentProject, User } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type ProjectTableProps = {
  projects: (StudentProject & {
    topic: ProjectTopic | null,
    student?: User,
    teacher?: User
  })[];
  onViewDetails?: (id: number) => void;
};

export default function ProjectTable({ projects, onViewDetails }: ProjectTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Topic</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Enrollment #</TableHead>
            <TableHead>Supervisor</TableHead>
            <TableHead>Technology</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">
                <div>
                  <p>{project.topic?.title || 'Unknown Topic'}</p>
                  <p className="text-sm text-muted-foreground">{project.topic?.description?.substring(0, 60)}...</p>
                </div>
              </TableCell>
              <TableCell>
                {project.student ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium text-sm">
                        {project.student.firstName.charAt(0)}
                        {project.student.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p>{`${project.student.firstName} ${project.student.lastName}`}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Unknown Student</span>
                )}
              </TableCell>
              <TableCell>{project.student?.enrollmentNumber || 'N/A'}</TableCell>
              <TableCell>
                {project.topic?.submittedBy ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                      <span className="text-secondary font-medium text-sm">
                        {project.topic.submittedBy.firstName.charAt(0)}
                        {project.topic.submittedBy.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p>{`${project.topic.submittedBy.firstName} ${project.topic.submittedBy.lastName}`}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Unknown Supervisor</span>
                )}
              </TableCell>
              <TableCell>{project.topic?.technology || 'Unknown'}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                    <div
                      className="bg-primary rounded-full h-2"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm">{project.progress}%</span>
                </div>
              </TableCell>
              <TableCell>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails && onViewDetails(project.id)}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}

          {projects.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                No projects found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
