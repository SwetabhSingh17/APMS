import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  enrollmentNumber: string;
  course: string;
  department: string;
}

interface StudentSelectProps {
  selectedEnrollments: string[];
  onChange: (enrollments: string[]) => void;
  courseFilter?: string;
  maxSelections?: number;
}

export function StudentSelect({ selectedEnrollments, onChange, courseFilter, maxSelections }: StudentSelectProps) {
  const [search, setSearch] = useState("");

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    return students.filter(student => {
      // Apply course filter if specified
      if (courseFilter && student.course !== courseFilter) return false;
      
      // Exclude already selected
      if (selectedEnrollments.includes(student.enrollmentNumber)) return false;

      // Match name or enrollment
      return (
        student.firstName.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query) ||
        student.enrollmentNumber.toLowerCase().includes(query)
      );
    }).slice(0, 10); // Show max 10 suggestions
  }, [students, search, courseFilter, selectedEnrollments]);

  const addStudent = (enrollment: string) => {
    if (maxSelections && selectedEnrollments.length >= maxSelections) {
      return; // Reached limit
    }
    onChange([...selectedEnrollments, enrollment]);
    setSearch("");
  };

  const removeStudent = (enrollment: string) => {
    onChange(selectedEnrollments.filter(e => e !== enrollment));
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          placeholder="Search student by name or enrollment number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        {search.trim() && (
          <div className="absolute z-10 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md">
            {isLoading ? (
              <div className="p-2 text-sm text-center text-muted-foreground">Loading...</div>
            ) : filteredStudents.length > 0 ? (
              <ScrollArea className="max-h-60">
                {filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer flex justify-between items-center"
                    onClick={() => addStudent(student.enrollmentNumber)}
                  >
                    <span>{student.firstName} {student.lastName}</span>
                    <Badge variant="outline">{student.enrollmentNumber}</Badge>
                  </div>
                ))}
              </ScrollArea>
            ) : (
              <div className="p-2 text-sm text-center text-muted-foreground">No matching students found.</div>
            )}
          </div>
        )}
      </div>

      {selectedEnrollments.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {selectedEnrollments.map((number) => {
              const student = students.find(s => s.enrollmentNumber === number);
              return (
                <Badge key={number} variant="secondary" className="flex items-center gap-1 p-1">
                  {student ? `${student.firstName} ${student.lastName} (${number})` : number}
                  <button type="button" onClick={() => removeStudent(number)} className="ml-1 hover:text-destructive">
                    <UserX className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
