import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Users, Search, ArrowRightLeft } from "lucide-react";
import { useCourseFilter } from "@/hooks/course-filter-context";

export default function ManageProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [changeSupervisorGroupId, setChangeSupervisorGroupId] = useState<number | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const { courseFilter, getCourseQuery } = useCourseFilter();

  // Fetch all supervisors
  const { data: supervisors } = useQuery({
    queryKey: ["/api/supervisors"],
    queryFn: async () => {
      const res = await fetch("/api/supervisors");
      if (!res.ok) throw new Error("Failed to fetch supervisors");
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch all student groups
  const { data: allGroups = [], isLoading: isLoadingAllGroups } = useQuery({
    queryKey: [`/api/student-groups/all${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
    queryFn: async () => {
      const res = await fetch(`/api/student-groups${getCourseQuery() ? `?${getCourseQuery()}` : ''}`);
      if (!res.ok) throw new Error("Failed to fetch all groups");
      return res.json();
    },
    enabled: !!user,
  });

  // Change supervisor mutation
  const changeSupervisorMutation = useMutation({
    mutationFn: async ({ groupId, supervisorId }: { groupId: number; supervisorId: number }) => {
      const res = await apiRequest("PATCH", `/api/student-groups/${groupId}/supervisor`, { supervisorId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Supervisor Updated",
        description: "The supervisor allotment has been changed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student-groups/all"] });
      setChangeSupervisorGroupId(null);
      setSelectedSupervisorId("");
    },
    onError: (error) => {
      toast({
        title: "Failed to change supervisor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter groups by search
  const filteredGroups = allGroups.filter((group: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      group.name?.toLowerCase().includes(q) ||
      group.description?.toLowerCase().includes(q) ||
      group.supervisor?.firstName?.toLowerCase().includes(q) ||
      group.supervisor?.lastName?.toLowerCase().includes(q) ||
      group.members?.some((m: any) =>
        m.firstName?.toLowerCase().includes(q) ||
        m.lastName?.toLowerCase().includes(q) ||
        m.enrollmentNumber?.toLowerCase().includes(q)
      )
    );
  });

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manage Project</h1>
            <p className="text-muted-foreground mt-1">Manage and reassign supervisors to student groups</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by group name, supervisor, student name or enrollment..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoadingAllGroups ? (
          <div className="flex justify-center items-center min-h-[40vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading groups...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No student groups found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredGroups.map((group: any) => (
              <Card key={group.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription className="mt-1">{group.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-accent/10 text-accent hover:bg-accent/20 border-accent/20">
                        {group.course || 'BCA'}
                      </Badge>
                      <Badge variant="outline">
                        {group.members?.length || 0} / {group.maxSize} Members
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Supervisor Info */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary text-sm">
                          {group.supervisor ? `${group.supervisor.firstName[0]}${group.supervisor.lastName[0]}` : "--"}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Supervisor</p>
                        <p className="font-medium">
                          {group.supervisor ? `${group.supervisor.firstName} ${group.supervisor.lastName}` : "Not Assigned"}
                        </p>
                      </div>
                    </div>
                    <Dialog
                      open={changeSupervisorGroupId === group.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setChangeSupervisorGroupId(group.id);
                          setSelectedSupervisorId(group.supervisor?.id?.toString() || "");
                        } else {
                          setChangeSupervisorGroupId(null);
                          setSelectedSupervisorId("");
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <ArrowRightLeft className="h-4 w-4" />
                          Change Supervisor
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Change Supervisor for "{group.name}"</DialogTitle>
                          <DialogDescription>
                            Select a new supervisor to assign to this group. Both the new and previous supervisor will be notified.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Select Supervisor</label>
                            <Select
                              value={selectedSupervisorId}
                              onValueChange={setSelectedSupervisorId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a supervisor" />
                              </SelectTrigger>
                              <SelectContent>
                                {supervisors?.map((s: User) => (
                                  <SelectItem key={s.id} value={s.id.toString()}>
                                    {s.firstName} {s.lastName} — {s.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setChangeSupervisorGroupId(null);
                                setSelectedSupervisorId("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                if (selectedSupervisorId) {
                                  changeSupervisorMutation.mutate({
                                    groupId: group.id,
                                    supervisorId: parseInt(selectedSupervisorId),
                                  });
                                }
                              }}
                              disabled={!selectedSupervisorId || changeSupervisorMutation.isPending}
                            >
                              {changeSupervisorMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                              ) : (
                                "Save Changes"
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Members List */}
                  <div>
                    <p className="text-sm font-medium mb-2 text-muted-foreground">Group Members</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.members?.map((member: any) => (
                        <div key={member.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                          <div className="w-7 h-7 rounded-full bg-background border flex items-center justify-center text-xs font-semibold shrink-0">
                            {member.firstName[0]}{member.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{member.firstName} {member.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.enrollmentNumber}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
