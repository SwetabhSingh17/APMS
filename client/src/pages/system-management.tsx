import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { Download, Trash2, Database, Upload, FileDown, Archive, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { UserRole } from "@shared/schema";
import { useLocation } from "wouter";

interface IBackupPreview {
    fileName: string;
    fileSizeKB: string;
    isZip: boolean;
    portalName?: string;
    version?: string;
    timestamp?: string;
    recordCounts?: {
        users?: number;
        studentGroups?: number;
        studentGroupMembers?: number;
        projectTopics?: number;
        studentProjects?: number;
        projectAssessments?: number;
        projectMilestones?: number;
        notifications?: number;
        totalRecords?: number;
    };
}

export default function SystemManagement() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [_, setLocation] = useLocation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Redirect if not admin
    if (user && user.role !== UserRole.ADMIN) {
        setLocation("/");
        return <></>;
    }

    // Admin Reset State
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [adminPassword, setAdminPassword] = useState("");

    // Import State & Pre-flight Inspection
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<IBackupPreview | null>(null);
    const [isInspecting, setIsInspecting] = useState(false);

    // File selection & pre-flight inspection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setSelectedFile(file);
        if (!file) {
            setPreview(null);
            return;
        }

        setIsInspecting(true);
        try {
            const isZip = file.name.endsWith(".zip");
            const sizeKB = (file.size / 1024).toFixed(1);

            if (isZip) {
                const JSZip = (await import("jszip")).default;
                const zip = await JSZip.loadAsync(file);
                let metadata: any = null;
                let recordCounts: any = {};

                const manifestFile = zip.file("manifest.json");
                if (manifestFile) {
                    const manifestText = await manifestFile.async("string");
                    metadata = JSON.parse(manifestText);
                    recordCounts = metadata.recordCounts || {};
                }

                setPreview({
                    fileName: file.name,
                    fileSizeKB: `${sizeKB} KB`,
                    isZip: true,
                    portalName: metadata?.portalName || "IU-APMP Archive",
                    version: metadata?.version || "2.2.0",
                    timestamp: metadata?.exportedAt || "N/A",
                    recordCounts
                });
            } else {
                const text = await file.text();
                const data = JSON.parse(text);
                const metadata = data.metadata || {};
                const recordCounts = metadata.recordCounts || {
                    users: data.users?.length || 0,
                    studentGroups: data.studentGroups?.length || 0,
                    studentGroupMembers: data.studentGroupMembers?.length || 0,
                    projectTopics: data.projectTopics?.length || 0,
                    studentProjects: data.studentProjects?.length || 0,
                    projectAssessments: data.projectAssessments?.length || 0,
                    projectMilestones: data.projectMilestones?.length || 0,
                    notifications: data.notifications?.length || 0
                };

                setPreview({
                    fileName: file.name,
                    fileSizeKB: `${sizeKB} KB`,
                    isZip: false,
                    portalName: metadata.portalName || "IU-APMP JSON Backup",
                    version: metadata.version || "2.2.0",
                    timestamp: metadata.exportedAt || data.timestamp || "N/A",
                    recordCounts
                });
            }
        } catch (err: any) {
            console.warn("Pre-flight inspection skipped:", err);
            setPreview({
                fileName: file.name,
                fileSizeKB: `${(file.size / 1024).toFixed(1)} KB`,
                isZip: file.name.endsWith(".zip")
            });
        } finally {
            setIsInspecting(false);
        }
    };

    // A-Z Backup Export Mutation (Downloads ZIP package)
    const exportMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/export", {
                method: "POST",
                credentials: "include"
            });
            if (!res.ok) throw new Error("Backup export failed");
            return res.blob();
        },
        onSuccess: (blob) => {
            const safeDate = new Date().toISOString().split("T")[0];
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `IU-APMP_Backup_${safeDate}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: "Backup & Export Successful",
                description: "Complete A-Z portal backup package (.zip) downloaded and retained on server.",
            });
        },
        onError: (error) => {
            toast({
                title: "Export Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    // Import Mutation
    const importMutation = useMutation({
        mutationFn: async () => {
            if (!selectedFile) throw new Error("No backup file selected");

            const formData = new FormData();
            formData.append("file", selectedFile);

            const res = await fetch("/api/admin/import", {
                method: "POST",
                body: formData,
                credentials: "include"
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Import failed");
            }
            return res.json();
        },
        onSuccess: () => {
            setImportDialogOpen(false);
            setSelectedFile(null);
            setPreview(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            toast({
                title: "Database Restored Successfully",
                description: "Database restored, foreign keys resolved, and sequences synchronized.",
            });
            queryClient.invalidateQueries();
        },
        onError: (error) => {
            toast({
                title: "Import Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    // Multi-Sheet University Excel Export Mutation
    const exportExcelMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/export-excel?multiSheet=true", {
                method: "POST",
                credentials: "include"
            });
            if (!res.ok) throw new Error("Excel export failed");
            return res.blob();
        },
        onSuccess: (blob) => {
            const safeDate = new Date().toISOString().split("T")[0];
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `IU-APMP_University_Report_${safeDate}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: "University Excel Report Downloaded",
                description: "Multi-sheet official university workbook (.xlsx) downloaded with all 8 worksheets.",
            });
        },
        onError: (error) => {
            toast({
                title: "Excel Export Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    // Reset Mutation
    const resetMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/admin/reset", { password: adminPassword });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Reset failed");
            }
        },
        onSuccess: () => {
            setResetDialogOpen(false);
            setAdminPassword("");
            queryClient.clear();
            toast({
                title: "System Reset Successful",
                description: "Database reset. Please log in with default credentials (admin / Admin@123).",
            });
            setLocation("/auth");
        },
        onError: (error) => {
            toast({
                title: "Reset Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    return (
        <MainLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground mb-1">System Management</h1>
                <p className="text-muted-foreground">Manage IU-APMP database backups, institutional exports, and system maintenance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl">
                {/* A-Z Backup & Export Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Archive className="h-6 w-6 text-primary" />
                            <CardTitle>A-Z Backup & Export</CardTitle>
                        </div>
                        <CardDescription>Export complete portal state (all 8 tables, grades, milestones, logs) into a ZIP archive.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Generates an all-inclusive backup package (.zip) containing per-table JSONs, full snapshot, manifest, and SQL recovery script. A timestamped copy is auto-retained in <code className="bg-muted px-1 py-0.5 rounded text-xs">database/backups/</code>.
                        </p>
                        <Button className="w-full gap-2" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                            <Download className="h-4 w-4" />
                            {exportMutation.isPending ? "Generating Archive..." : "Backup & Export Portal (.zip)"}
                        </Button>
                    </CardContent>
                </Card>

                {/* University Excel Report Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <FileDown className="h-6 w-6 text-primary" />
                            <CardTitle>University Excel Report</CardTitle>
                        </div>
                        <CardDescription>Official 8-sheet Excel workbook for university administrative use.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Exports a formatted 8-sheet master workbook (.xlsx) with Overview KPIs, Students Master, Faculty Supervisors, Teams, Topics Catalog, Allocations, Assessments, and Milestones.
                        </p>
                        <Button className="w-full gap-2" variant="secondary" onClick={() => exportExcelMutation.mutate()} disabled={exportExcelMutation.isPending}>
                            <FileDown className="h-4 w-4" />
                            {exportExcelMutation.isPending ? "Generating Report..." : "Export University Excel (.xlsx)"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Import/Restore Data Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Upload className="h-6 w-6 text-primary" />
                            <CardTitle>Portal Import & Restore</CardTitle>
                        </div>
                        <CardDescription>Restore system from a ZIP or JSON backup replicating original state exactly.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Restores database in topological dependency order (resolving foreign keys), re-syncs sequences, and auto-generates a safety snapshot of the live database before applying.
                        </p>
                        <Dialog open={importDialogOpen} onOpenChange={(open) => {
                            setImportDialogOpen(open);
                            if (!open) {
                                setSelectedFile(null);
                                setPreview(null);
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button className="w-full gap-2" variant="secondary">
                                    <Upload className="h-4 w-4" />
                                    Import & Restore Portal
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl">
                                <DialogHeader>
                                    <DialogTitle>Confirm Portal Import & Restore</DialogTitle>
                                    <DialogDescription>
                                        Select an official IU-APMP backup file (.zip or .json) to restore.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Backup File (.zip or .json)</label>
                                        <Input
                                            ref={fileInputRef}
                                            type="file"
                                            aria-label="Backup file"
                                            accept=".zip,.json"
                                            onChange={handleFileChange}
                                        />
                                        {isInspecting && (
                                            <p className="text-xs text-muted-foreground animate-pulse">
                                                Inspecting backup manifest and structure...
                                            </p>
                                        )}
                                    </div>

                                    {preview && (
                                        <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
                                            <div className="flex items-center justify-between font-medium">
                                                <span className="flex items-center gap-1.5 text-primary">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    {preview.portalName || "IU-APMP Backup"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{preview.fileSizeKB}</span>
                                            </div>
                                            {preview.timestamp && (
                                                <p className="text-xs text-muted-foreground">
                                                    Created: {preview.timestamp} {preview.version && `(v${preview.version})`}
                                                </p>
                                            )}
                                            {preview.recordCounts && (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                                                    <div className="rounded bg-background p-1.5 border text-center">
                                                        <div className="font-semibold text-foreground">{preview.recordCounts.users ?? "—"}</div>
                                                        <div className="text-muted-foreground">Users</div>
                                                    </div>
                                                    <div className="rounded bg-background p-1.5 border text-center">
                                                        <div className="font-semibold text-foreground">{preview.recordCounts.studentGroups ?? "—"}</div>
                                                        <div className="text-muted-foreground">Teams</div>
                                                    </div>
                                                    <div className="rounded bg-background p-1.5 border text-center">
                                                        <div className="font-semibold text-foreground">{preview.recordCounts.projectTopics ?? "—"}</div>
                                                        <div className="text-muted-foreground">Topics</div>
                                                    </div>
                                                    <div className="rounded bg-background p-1.5 border text-center">
                                                        <div className="font-semibold text-foreground">{preview.recordCounts.studentProjects ?? "—"}</div>
                                                        <div className="text-muted-foreground">Projects</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-start gap-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                                        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>
                                            <strong>Zero-Data-Loss Safety:</strong> An automatic pre-restore safety snapshot of the live database will be created in <code className="bg-emerald-500/20 px-1 py-0.5 rounded">database/backups/</code> before restoring, ensuring immediate recovery if needed.
                                        </span>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                                    <Button
                                        onClick={() => importMutation.mutate()}
                                        disabled={!selectedFile || importMutation.isPending || isInspecting}
                                    >
                                        {importMutation.isPending ? "Restoring Database..." : "Confirm & Restore"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>

                {/* Reset Database Card */}
                <Card className="border-destructive/50">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-6 w-6" />
                            <CardTitle>System Reset</CardTitle>
                        </div>
                        <CardDescription>Reset the entire system to its initial state.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Warning: This action is irreversible. All data (students, projects, history) will be wiped. Only the admin account will remain.
                        </p>
                        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="destructive"
                                    className="w-full gap-2"
                                    onClick={() => toast({
                                        title: "Export your data first",
                                        description: "Reset is instant and irreversible. Click 'Backup & Export' before proceeding if you want an archive of current records.",
                                        variant: "destructive",
                                    })}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Reset Database
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Confirm System Reset</DialogTitle>
                                    <DialogDescription>
                                        This action cannot be undone. Please enter your admin password to confirm.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    Tip: If you haven't already, cancel and run <span className="font-semibold">Backup & Export Portal</span> first —
                                    the reset wipes everything instantly and gives you no way back.
                                </div>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Admin Password</label>
                                        <Input
                                            type="password"
                                            placeholder="Enter password"
                                            aria-label="Admin Password"
                                            value={adminPassword}
                                            onChange={(e) => setAdminPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => resetMutation.mutate()}
                                        disabled={!adminPassword || resetMutation.isPending}
                                    >
                                        {resetMutation.isPending ? "Resetting..." : "Confirm Reset"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
