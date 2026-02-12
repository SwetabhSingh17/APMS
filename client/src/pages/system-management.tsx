import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { Download, Trash2, Database, Upload, FileDown } from "lucide-react";
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
import * as XLSX from 'xlsx';

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

    // Import State
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Export Mutation
    const exportMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/admin/export", {});
            if (!res.ok) throw new Error("Export failed");
            return res.blob();
        },
        onSuccess: (blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project-hub-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: "Export Successful",
                description: "Data exported successfully.",
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
            if (!selectedFile) throw new Error("No file selected");

            const fileContent = await selectedFile.text();
            const data = JSON.parse(fileContent);

            const res = await apiRequest("POST", "/api/admin/import", data);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Import failed");
            }
            return res.json();
        },
        onSuccess: () => {
            setImportDialogOpen(false);
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            toast({
                title: "Import Successful",
                description: "Database restored successfully. Please log in again.",
            });
            // Clear auth state and redirect to login
            queryClient.setQueryData(["/api/user"], null);
            setLocation("/auth");
        },
        onError: (error) => {
            toast({
                title: "Import Failed",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    // Excel Export Mutation
    const exportExcelMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/admin/export-excel", {});
            if (!res.ok) throw new Error("Excel export failed");
            return res.json();
        },
        onSuccess: (result) => {
            // Create worksheet from data
            const ws = XLSX.utils.json_to_sheet(result.data);
            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Projects Report");
            // Generate Excel file and download
            XLSX.writeFile(wb, `project-report-${new Date().toISOString().split('T')[0]}.xlsx`);

            toast({
                title: "Export Successful",
                description: "Excel report downloaded successfully.",
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
            toast({
                title: "System Reset Successful",
                description: "Database reset. Please log in with default credentials (admin / Admin@123).",
            });
            // Clear auth state and redirect to login
            queryClient.setQueryData(["/api/user"], null);
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
                <p className="text-muted-foreground">Manage database backups and system resets.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl">
                {/* Export Data Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Database className="h-6 w-6 text-primary" />
                            <CardTitle>Data Export</CardTitle>
                        </div>
                        <CardDescription>Export all system data (users, projects, topics) to JSON format.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            This will generate a full backup of the system database. Use this for archiving or migration purposes.
                        </p>
                        <Button className="w-full gap-2" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                            <Download className="h-4 w-4" />
                            {exportMutation.isPending ? "Exporting..." : "Export Database"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Excel Export Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <FileDown className="h-6 w-6 text-primary" />
                            <CardTitle>Excel Report</CardTitle>
                        </div>
                        <CardDescription>Generate comprehensive Excel report of all projects.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Export a detailed Excel spreadsheet with student info, projects, marks, groups, and submission status.
                        </p>
                        <Button className="w-full gap-2" variant="secondary" onClick={() => exportExcelMutation.mutate()} disabled={exportExcelMutation.isPending}>
                            <FileDown className="h-4 w-4" />
                            {exportExcelMutation.isPending ? "Generating..." : "Export as Excel"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Import/Restore Data Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Upload className="h-6 w-6 text-primary" />
                            <CardTitle>Data Import</CardTitle>
                        </div>
                        <CardDescription>Restore system from a previously exported JSON backup.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Warning: This will replace current data with the backup. Ensure you have a current export before proceeding.
                        </p>
                        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full gap-2" variant="secondary">
                                    <Upload className="h-4 w-4" />
                                    Import Database
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Confirm Database Import</DialogTitle>
                                    <DialogDescription>
                                        Select a backup file to restore. This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Backup File</label>
                                        <Input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".json"
                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        />
                                        {selectedFile && (
                                            <p className="text-xs text-muted-foreground">
                                                Selected: {selectedFile.name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                                    <Button
                                        onClick={() => importMutation.mutate()}
                                        disabled={!selectedFile || importMutation.isPending}
                                    >
                                        {importMutation.isPending ? "Importing..." : "Confirm Import"}
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
                                <Button variant="destructive" className="w-full gap-2">
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
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Admin Password</label>
                                        <Input
                                            type="password"
                                            placeholder="Enter password"
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
