import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ISupervisorOnboardingResult } from "@shared/schema";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
  Briefcase,
  Terminal,
  Activity,
  Check,
  UserCheck,
  Building2
} from "lucide-react";

interface ISupervisorProgressState {
  stage: string;
  percent: number;
  message: string;
  detail: string;
}

const INITIAL_PROGRESS: ISupervisorProgressState = {
  stage: "uploading",
  percent: 0,
  message: "",
  detail: "",
};

interface ISupervisorBulkOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dedicated Bulk Onboarding Modal for Supervisors and Faculty Members.
 * Parses official staff lists (.xls / .xlsx), provisions accounts with EmpID credentials,
 * enforces first-login mandatory password change, and associates faculty designations.
 */
export function SupervisorBulkOnboardingModal({ isOpen, onClose }: ISupervisorBulkOnboardingModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ISupervisorOnboardingResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<ISupervisorProgressState>(INITIAL_PROGRESS);
  const [showLogs, setShowLogs] = useState(false);
  const [logEntries, setLogEntries] = useState<Array<{ time: string; text: string; stage: string }>>([]);

  const addLog = (text: string, stage: string = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogEntries((prev) => [...prev.slice(-99), { time, text, stage }]);
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setIsUploading(false);
    setProgress(INITIAL_PROGRESS);
    setLogEntries([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadDemo = async () => {
    try {
      const response = await fetch("/api/admin/onboarding/supervisor/demo-template");
      if (!response.ok) throw new Error("Failed to download supervisor template");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "APMS_Supervisor_Staff_List_Demo_Format.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Demo Format Downloaded",
        description: "Official supervisor faculty Excel template downloaded successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Download Failed",
        description: err.message || "Could not download demo format",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an Excel spreadsheet (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        title: "File Required",
        description: "Please select a supervisor directory file (.xls or .xlsx)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProgress({
      stage: "uploading",
      percent: 10,
      message: "Sending file to server...",
      detail: `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`,
    });
    setLogEntries([]);
    addLog(`Initiating supervisor upload for ${selectedFile.name}`, "upload");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/admin/onboarding/supervisor/upload?stream=true", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Upload failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const eventData = JSON.parse(line.slice(6));

                setProgress({
                  stage: eventData.stage || "processing",
                  percent: eventData.percent || 50,
                  message: eventData.message || "Processing...",
                  detail: eventData.detail || "",
                });

                if (eventData.message) {
                  addLog(eventData.message, eventData.stage || "info");
                }

                if (eventData.stage === "completed" && eventData.result) {
                  setUploadResult(eventData.result);
                  queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                } else if (eventData.stage === "error") {
                  throw new Error(eventData.message || "Failed to process supervisor file");
                }
              } catch (e: any) {
                if (e.message && !e.message.includes("JSON")) {
                  throw e;
                }
              }
            }
          }
        }
      }

      setProgress({
        stage: "completed",
        percent: 100,
        message: "Supervisor onboarding process finished successfully.",
        detail: "All accounts provisioned with Employee ID credentials",
      });
      addLog("All supervisor records successfully synchronized", "completed");

      toast({
        title: "Supervisor Onboarding Completed",
        description: "Supervisor accounts provisioned and synced successfully.",
      });
    } catch (error: any) {
      console.error("Supervisor bulk onboarding error:", error);
      setProgress({
        stage: "error",
        percent: 100,
        message: error.message || "Failed to complete supervisor onboarding",
        detail: "Check the uploaded sheet format and columns",
      });
      addLog(`Error: ${error.message}`, "error");

      toast({
        title: "Onboarding Failed",
        description: error.message || "An unexpected error occurred during supervisor onboarding.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleReset();
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Bulk Upload Supervisors
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Onboard faculty supervisors via official Excel directory (.xls or .xlsx)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Top Banner: Guidelines and Demo Template Download */}
          <div className="rounded-xl border border-purple-100 bg-purple-50/60 dark:bg-purple-950/20 dark:border-purple-900/40 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold text-sm text-foreground">
                    Official Supervisor Directory Format
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expected columns: <code className="bg-muted/70 px-1 py-0.5 rounded text-[11px] font-mono">Emp. ID.</code>,{" "}
                  <code className="bg-muted/70 px-1 py-0.5 rounded text-[11px] font-mono">Employee Name</code>,{" "}
                  <code className="bg-muted/70 px-1 py-0.5 rounded text-[11px] font-mono">Designation</code>,{" "}
                  <code className="bg-muted/70 px-1 py-0.5 rounded text-[11px] font-mono">Mobile</code>,{" "}
                  <code className="bg-muted/70 px-1 py-0.5 rounded text-[11px] font-mono">Official Email</code>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadDemo}
                className="shrink-0 bg-background/80 hover:bg-background border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download Demo Format
              </Button>
            </div>
          </div>

          {/* Account Provisioning Rules Notice */}
          <div className="rounded-lg bg-muted/40 border p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-medium text-foreground">Account Provisioning & Security:</span>
              <p>
                Each supervisor account is created with <strong className="text-foreground">Username = EmpID</strong> and an initial temporary password set to their Employee ID. The mandatory password change will be enforced immediately upon their first login.
              </p>
            </div>
          </div>

          {/* File Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? "border-purple-500 bg-purple-500/5 scale-[0.99]"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10"
                : "border-border hover:border-purple-400 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Ready for supervisor provisioning
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to browse or drag & drop supervisor file
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supports <span className="font-medium text-foreground">.xls</span> (Staff List) and <span className="font-medium text-foreground">.xlsx</span> formats
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Progress and Telemetry Section */}
          {(isUploading || progress.percent > 0) && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-500" />
                  {progress.message || "Processing..."}
                </span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {progress.percent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    progress.stage === "error"
                      ? "bg-rose-500"
                      : progress.stage === "completed"
                      ? "bg-emerald-500"
                      : "bg-purple-600"
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {progress.detail && (
                <p className="text-[11px] text-muted-foreground truncate font-mono">
                  {progress.detail}
                </p>
              )}

              {/* Toggle Event Logs */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
                >
                  <Terminal className="w-3 h-3" />
                  {showLogs ? "Hide detailed log" : "Show detailed log"} ({logEntries.length} events)
                </button>

                {showLogs && (
                  <div
                    ref={logContainerRef}
                    className="mt-2 p-2.5 rounded bg-slate-950 text-slate-200 font-mono text-[11px] max-h-36 overflow-y-auto space-y-1"
                  >
                    {logEntries.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-slate-500 shrink-0">{log.time}</span>
                        <span className={log.stage === "error" ? "text-rose-400" : log.stage === "completed" ? "text-emerald-400" : "text-slate-300"}>
                          {log.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Summary Card */}
          {uploadResult && (
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-semibold text-sm">
                  {uploadResult.message}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 rounded-lg bg-background/80 border">
                  <p className="text-xs text-muted-foreground">Processed</p>
                  <p className="text-lg font-bold text-foreground">{uploadResult.totalSupervisorsProcessed}</p>
                </div>
                <div className="p-2 rounded-lg bg-background/80 border">
                  <p className="text-xs text-muted-foreground">New Accounts</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    +{uploadResult.totalSupervisorsCreated}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-background/80 border">
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {uploadResult.totalSupervisorsUpdated}
                  </p>
                </div>
              </div>

              {/* Sample list of onboarded faculty */}
              {uploadResult.supervisors && uploadResult.supervisors.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Onboarded Faculty Directory ({uploadResult.supervisors.length} records):
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border bg-background/90 divide-y text-xs">
                    {uploadResult.supervisors.map((s, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                            {s.empId}
                          </Badge>
                          <span className="font-medium text-foreground truncate">{s.name}</span>
                          <span className="text-muted-foreground text-[11px] truncate">({s.designation})</span>
                        </div>
                        <Badge variant={s.isNew ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {s.isNew ? "Created" : "Updated"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              handleReset();
              onClose();
            }}
            disabled={isUploading}
          >
            {uploadResult ? "Close" : "Cancel"}
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {uploadResult ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="gap-1.5 w-full sm:w-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Upload Another File
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedFile || isUploading}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 w-full sm:w-auto shadow-sm"
              >
                {isUploading ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    Processing Faculty...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Upload & Provision Supervisors
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
