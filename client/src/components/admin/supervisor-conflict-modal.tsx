import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Copy,
  ArrowRightLeft,
  Loader2,
  Search,
  Users,
  FolderGit2,
  CheckCircle2,
  Info,
  ShieldAlert,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ISupervisorConflict } from "@shared/schema";

interface ISupervisorConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts?: ISupervisorConflict[];
  selectedConflict?: ISupervisorConflict | null;
  onResolved?: () => void;
}

export function SupervisorConflictModal({
  open,
  onOpenChange,
  conflicts: propConflicts,
  selectedConflict: initialSelectedConflict,
  onResolved,
}: ISupervisorConflictModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeResolutionGroupId, setActiveResolutionGroupId] = useState<number | null>(null);

  // If conflicts are not passed as props, query them automatically when opened
  const { data: conflictData } = useQuery<{ conflicts: ISupervisorConflict[], count: number }>({
    queryKey: ["/api/admin/supervisor-conflicts"],
    enabled: open && !propConflicts,
  });

  const conflicts = propConflicts || conflictData?.conflicts || [];

  // For single-conflict mode (when selectedConflict is supplied)
  const [singleSelectedMode, setSingleSelectedMode] = useState<"copy" | "migrate">("copy");

  const resolveMutation = useMutation({
    mutationFn: async ({
      groupId,
      resolution,
      newSupervisorId,
    }: {
      groupId: number;
      resolution: "copy" | "migrate";
      newSupervisorId?: number;
    }) => {
      setActiveResolutionGroupId(groupId);
      const res = await apiRequest("POST", "/api/admin/supervisor-conflicts/resolve", {
        groupId,
        resolution,
        newSupervisorId,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conflict Resolved Successfully",
        description: data.message || "Supervisor allotment and project aligned.",
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" &&
            (key.startsWith("/api/admin/supervisor-conflicts") ||
              key.startsWith("/api/student-groups") ||
              key.startsWith("/api/projects") ||
              key.startsWith("/api/topics") ||
              key.startsWith("/api/stats") ||
              key.startsWith("/api/admin/supervisors-summary"))
          );
        },
      });
      setActiveResolutionGroupId(null);
      if (onResolved) onResolved();
      if (initialSelectedConflict) {
        onOpenChange(false);
      }
    },
    onError: (error: any) => {
      setActiveResolutionGroupId(null);
      toast({
        title: "Resolution Failed",
        description: error.message || "Failed to resolve supervisor conflict",
        variant: "destructive",
      });
    },
  });

  const filteredConflicts = conflicts.filter((c: ISupervisorConflict) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.groupName.toLowerCase().includes(q) ||
      (c.projectTeamId && c.projectTeamId.toLowerCase().includes(q)) ||
      c.topicTitle.toLowerCase().includes(q) ||
      (c.topicCode && c.topicCode.toLowerCase().includes(q)) ||
      c.oldSupervisor.name.toLowerCase().includes(q) ||
      c.newSupervisor.name.toLowerCase().includes(q)
    );
  });

  // Single Conflict Mode View
  if (initialSelectedConflict) {
    const conflict = initialSelectedConflict;
    const isBusy = resolveMutation.isPending && activeResolutionGroupId === conflict.groupId;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-6 w-6" />
              <DialogTitle className="text-xl">Supervisor Allotment Conflict Warning</DialogTitle>
            </div>
            <DialogDescription className="text-sm pt-1 text-muted-foreground">
              This team is already allotted to project{" "}
              <strong className="text-foreground">"{conflict.topicTitle}"</strong>, which was
              originally submitted by{" "}
              <strong className="text-foreground">{conflict.oldSupervisor.name}</strong>. Reassigning the
              supervisor to{" "}
              <strong className="text-foreground">{conflict.newSupervisor.name}</strong> creates an
              ownership mismatch.
            </DialogDescription>
          </DialogHeader>

          {/* Details Overview Card */}
          <div className="p-3.5 rounded-lg border bg-amber-500/5 border-amber-500/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{conflict.groupName}</span>
                {conflict.projectTeamId && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Team {conflict.projectTeamId}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {conflict.course || "BCA"}
                </Badge>
              </div>
              <span className="text-muted-foreground">{conflict.membersCount} accepted student(s)</span>
            </div>

            <div className="p-2.5 rounded-md bg-background border border-border/60 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono font-bold text-primary">
                  {conflict.topicCode || `TOPIC-${conflict.topicId}`}
                </span>
                <span className="font-medium text-foreground truncate">{conflict.topicTitle}</span>
              </div>
              {conflict.technology && (
                <p className="text-muted-foreground pl-6 truncate text-[11px]">
                  Tech Stack: {conflict.technology}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-2.5 rounded-md border bg-muted/30">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Topic Proposer (Old Supervisor)
                </p>
                <p className="font-semibold text-foreground text-sm">{conflict.oldSupervisor.name}</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {conflict.oldSupervisor.empId ? `Emp ID: ${conflict.oldSupervisor.empId} • ` : ""}
                  {conflict.oldSupervisor.department || conflict.oldSupervisor.email}
                </p>
              </div>

              <div className="p-2.5 rounded-md border bg-primary/5 border-primary/20">
                <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
                  Assigned Mentor (New Supervisor)
                </p>
                <p className="font-semibold text-foreground text-sm">{conflict.newSupervisor.name}</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {conflict.newSupervisor.empId ? `Emp ID: ${conflict.newSupervisor.empId} • ` : ""}
                  {conflict.newSupervisor.department || conflict.newSupervisor.email}
                </p>
              </div>
            </div>
          </div>

          {/* 2 Options Selection */}
          <div className="space-y-3 pt-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <span>Select Resolution Strategy:</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Copy */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSingleSelectedMode("copy")}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  singleSelectedMode === "copy"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border hover:bg-muted/50 bg-card"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <Copy className="h-4 w-4 text-primary shrink-0" />
                      <span>Option 1: Copy Project</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      New PUGID
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    System creates an exact clone of the project, assigns it a fresh auto-incremented PUGID, and
                    allots it to <strong>{conflict.newSupervisor.name}</strong> with this team.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border/50 text-[11px] text-primary/90 font-medium">
                  ✓ {conflict.oldSupervisor.name} keeps original {conflict.topicCode || "project"} in catalog as available.
                </div>
              </div>

              {/* Option 2: Migrate */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSingleSelectedMode("migrate")}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  singleSelectedMode === "migrate"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border hover:bg-muted/50 bg-card"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <ArrowRightLeft className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>Option 2: Migrate Project</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-200">
                      Same PUGID
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Transfers the existing project and PUGID ({conflict.topicCode}) directly from{" "}
                    <strong>{conflict.oldSupervisor.name}</strong> to{" "}
                    <strong>{conflict.newSupervisor.name}</strong>.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border/50 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  ✓ Project is removed from {conflict.oldSupervisor.name} and fully transferred.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              disabled={isBusy}
              onClick={() =>
                resolveMutation.mutate({
                  groupId: conflict.groupId,
                  resolution: singleSelectedMode,
                  newSupervisorId: conflict.newSupervisor.id,
                })
              }
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Applying Resolution...
                </>
              ) : (
                `Confirm & ${singleSelectedMode === "copy" ? "Copy Project" : "Migrate Project"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Global Multi-Conflict Review View
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-6 w-6" />
            <DialogTitle className="text-xl">Supervisor Allotment Conflict Resolution</DialogTitle>
            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 ml-auto">
              {conflicts.length} {conflicts.length === 1 ? "Conflict" : "Conflicts"}
            </Badge>
          </div>
          <DialogDescription className="text-sm pt-1 text-muted-foreground">
            The following project teams have an allotted supervisor that differs from the faculty member who
            originally proposed the project topic. This causes teams and topics to appear on multiple supervisor
            dashboards. Choose an option below for each team to resolve the conflict.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative my-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search conflicts by team name, PUGID code, topic title, or supervisor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Conflicts List */}
        <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
          {filteredConflicts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border rounded-lg bg-muted/10">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-80" />
              <p className="text-base font-semibold text-foreground">No Supervisor Conflicts Found</p>
              <p className="text-xs mt-1">
                {conflicts.length === 0
                  ? "All active project teams are correctly synchronized with their topic proposers."
                  : "No conflicts matched your search filter."}
              </p>
            </div>
          ) : (
            filteredConflicts.map((c: ISupervisorConflict, idx: number) => {
              const isBusy = resolveMutation.isPending && activeResolutionGroupId === c.groupId;

              return (
                <Card key={c.groupId} className="p-4 border border-border shadow-xs hover:border-amber-500/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                      <span className="font-semibold text-foreground text-sm">{c.groupName}</span>
                      {c.projectTeamId && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.projectTeamId}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {c.course || "BCA"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{c.membersCount} student(s)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 text-xs">
                    {/* Project Information */}
                    <div className="md:col-span-5 space-y-1.5 p-2.5 rounded-lg bg-muted/20 border border-border/50">
                      <div className="flex items-center gap-1.5 text-primary">
                        <FolderGit2 className="h-4 w-4 shrink-0" />
                        <span className="font-mono font-bold">{c.topicCode || `TOPIC-${c.topicId}`}</span>
                      </div>
                      <p className="font-medium text-foreground leading-snug line-clamp-2" title={c.topicTitle}>
                        {c.topicTitle}
                      </p>
                      {c.technology && (
                        <p className="text-muted-foreground text-[11px] truncate">
                          Tech: {c.technology}
                        </p>
                      )}
                    </div>

                    {/* Supervisors comparison */}
                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg border bg-muted/10">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-0.5">
                          Old Supervisor (Proposer)
                        </p>
                        <p className="font-semibold text-foreground truncate">{c.oldSupervisor.name}</p>
                        <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                          {c.oldSupervisor.empId ? `Emp: ${c.oldSupervisor.empId}` : c.oldSupervisor.email}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg border bg-primary/5 border-primary/20">
                        <p className="text-[10px] font-semibold uppercase text-primary tracking-wider mb-0.5">
                          New Supervisor (Allotted)
                        </p>
                        <p className="font-semibold text-foreground truncate">{c.newSupervisor.name}</p>
                        <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                          {c.newSupervisor.empId ? `Emp: ${c.newSupervisor.empId}` : c.newSupervisor.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Resolution Action Buttons */}
                  <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>Choose how to reconcile project ownership between supervisors:</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 hover:border-primary hover:text-primary hover:bg-primary/5"
                        disabled={isBusy}
                        onClick={() =>
                          resolveMutation.mutate({
                            groupId: c.groupId,
                            resolution: "copy",
                            newSupervisorId: c.newSupervisor.id,
                          })
                        }
                        title="Copy project with new sequential PUGID. Old supervisor keeps original topic."
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span>Option 1: Copy Project</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                        disabled={isBusy}
                        onClick={() =>
                          resolveMutation.mutate({
                            groupId: c.groupId,
                            resolution: "migrate",
                            newSupervisorId: c.newSupervisor.id,
                          })
                        }
                        title="Migrate existing project & PUGID to new supervisor. Removed from old supervisor."
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        )}
                        <span>Option 2: Migrate Project</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
