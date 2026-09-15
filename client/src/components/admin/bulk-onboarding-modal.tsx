import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { IOnboardingResult, IOnboardingProgress } from "@shared/schema";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Users,
  Layers,
  GraduationCap,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
  Terminal,
  Activity,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";

/**
 * Static pipeline step definitions lifted outside the component
 * to prevent dynamic JSX type churn and unmemoized object churn during rapid renders.
 */
const PIPELINE_STEPS = [
  { id: 0, label: "Upload", icon: UploadCloud },
  { id: 1, label: "Parse Sheets", icon: Layers },
  { id: 2, label: "Provisioning", icon: ShieldCheck },
  { id: 3, label: "Team Binding", icon: Users },
] as const;

interface IProgressState {
  stage: IOnboardingProgress["stage"];
  percent: number;
  message: string;
  detail: string;
}

const INITIAL_PROGRESS: IProgressState = {
  stage: "uploading",
  percent: 0,
  message: "",
  detail: "",
};

/**
 * Properties for the student bulk onboarding modal
 */
interface IBulkOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal component for bulk Excel onboarding and automated student provisioning.
 * Features mandatory academic program selection (BCA or MCA) for strict data isolation,
 * real-time SSE streaming progress bar, live event telemetry, and safe download tools.
 */
export function BulkOnboardingModal({ isOpen, onClose }: IBulkOnboardingModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [selectedCourse, setSelectedCourse] = useState<"BCA" | "MCA">("BCA");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<IOnboardingResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Consolidated real-time progress tracking state (atomic updates prevent React dispatcher collisions)
  const [showProgressTelemetry, setShowProgressTelemetry] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [progress, setProgress] = useState<IProgressState>(INITIAL_PROGRESS);
  const [logEntries, setLogEntries] = useState<Array<{ time: string; text: string; stage: string }>>([]);

  // Helper to add a timestamped event log
  const addLog = (text: string, stage: string = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogEntries((prev) => [...prev.slice(-99), { time, text, stage }]);
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  // Reset modal state upon closing or beginning a new upload
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

  const handleClose = () => {
    if (isUploading) {
      toast({
        title: "Upload in Progress",
        description: "Please wait until the bulk onboarding process finishes before closing.",
        variant: "destructive",
      });
      return;
    }
    handleReset();
    onClose();
  };

  // Direct download of the demo Excel template using authenticated credentials and blob creation
  const handleDownloadDemo = async () => {
    try {
      toast({
        title: "Downloading Demo Template",
        description: "Generating official APMS_Student_Onboarding_Demo_Format.xlsx...",
      });

      const res = await fetch("/api/admin/onboarding/demo-template", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Session expired or unauthorized. Please log in again."
            : "Failed to download demo template."
        );
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "APMS_Student_Onboarding_Demo_Format.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Download Started",
        description: "Demo format downloaded successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Download Failed",
        description: err.message || "Could not retrieve demo template.",
        variant: "destructive",
      });
    }
  };

  // Handle file selection from standard input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast({
          title: "Invalid File Format",
          description: "Please select a valid Excel workbook (.xlsx or .xls).",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Drag and drop event handlers
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
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast({
          title: "Invalid File Format",
          description: "Please drop a valid Excel workbook (.xlsx or .xls).",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Upload file and initiate multi-sheet parsing on server with real-time SSE progress streaming
  const handleUploadAndProcess = async () => {
    if (!selectedFile) {
      toast({
        title: "File Required",
        description: "Please select an Excel file to proceed.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProgress({
      percent: 5,
      stage: "uploading",
      message: "Uploading Excel workbook to server...",
      detail: `File: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`,
    });
    setLogEntries([]);
    addLog(`Initiated bulk onboarding for ${selectedCourse} program`, "info");
    addLog(`Uploading ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)...`, "uploading");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("course", selectedCourse);

      // Always include credentials to preserve the express-session cookie
      const response = await fetch("/api/admin/onboarding/upload?stream=true", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          Accept: "text/event-stream",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired or you are unauthorized. Please refresh and log in again.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Server responded with status code ${response.status}`);
      }

      // Check if response is streaming SSE
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: IOnboardingResult | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";

          for (const message of messages) {
            const lines = message.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const update: IOnboardingProgress = JSON.parse(line.slice(6));
                  setProgress({
                    stage: update.stage,
                    percent: update.percent,
                    message: update.message,
                    detail: update.detail || "",
                  });
                  addLog(update.message, update.stage);

                  if (update.stage === "error") {
                    throw new Error(update.message);
                  }

                  if (update.stage === "completed" && update.result) {
                    finalResult = update.result;
                  }
                } catch (jsonErr: any) {
                  if (jsonErr.message && !jsonErr.message.includes("JSON")) {
                    throw jsonErr;
                  }
                }
              }
            }
          }
        }

        if (finalResult) {
          setUploadResult(finalResult);
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          queryClient.invalidateQueries({ queryKey: ["/api/student-groups"] });

          toast({
            title: "Provisioning Successful",
            description: `${finalResult.totalStudentsProcessed} students registered across ${finalResult.totalTeamsCreated} teams for ${selectedCourse}.`,
          });
        } else {
          throw new Error("Streaming finished but no completion payload was returned.");
        }
      } else {
        // Fallback for standard JSON response
        const data: IOnboardingResult = await response.json();
        setProgress({
          percent: 100,
          stage: "completed",
          message: data.message || "Completed",
          detail: "",
        });
        setUploadResult(data);

        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["/api/student-groups"] });

        toast({
          title: "Provisioning Successful",
          description: `${data.totalStudentsProcessed} students registered across ${data.totalTeamsCreated} teams for ${selectedCourse}.`,
        });
      }
    } catch (err: any) {
      console.error("Bulk onboarding error:", err);
      setProgress((prev) => ({ ...prev, stage: "error" }));
      addLog(`Error: ${err.message}`, "error");
      toast({
        title: "Bulk Onboarding Failed",
        description: err.message || "An error occurred while processing the Excel workbook.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to determine step status
  const getStepStatus = (stepIndex: number) => {
    // 0: Upload, 1: Parse, 2: Provision, 3: Teams
    if (progress.stage === "completed") return "done";
    if (progress.stage === "error") return "error";

    switch (stepIndex) {
      case 0: // Upload
        return progress.percent >= 15 ? "done" : "active";
      case 1: // Parse
        return progress.percent >= 30 ? "done" : progress.percent >= 15 ? "active" : "pending";
      case 2: // Provision
        return progress.percent >= 75 ? "done" : progress.percent >= 30 ? "active" : "pending";
      case 3: // Teams
        return progress.percent >= 98 ? "done" : progress.percent >= 75 ? "active" : "pending";
      default:
        return "pending";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-primary">
            <FileSpreadsheet className="w-6 h-6" />
            <DialogTitle className="text-xl font-bold">
              Bulk Student Onboarding & Team Formation
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Import student cohorts and automated team assignments directly from multi-sheet Excel workbooks with live progress tracking.
          </DialogDescription>
        </DialogHeader>

        {!uploadResult ? (
          <div className="space-y-6 py-2">
            {/* Step 1: Mandatory course selection for data isolation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  1. Select Target Academic Program (Strict Isolation)
                </label>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Mandatory
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* BCA Option */}
                <div
                  onClick={() => (!isUploading ? setSelectedCourse("BCA") : null)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 relative ${
                    selectedCourse === "BCA"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md"
                      : "border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30"
                  } ${isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base text-foreground">BCA Program</span>
                    {selectedCourse === "BCA" && (
                      <CheckCircle2 className="w-5 h-5 text-primary animate-in zoom-in" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bachelor of Computer Applications. Teams of <strong>2 to 5 students</strong>. Topic selection directly from supervisor catalog.
                  </p>
                </div>

                {/* MCA Option */}
                <div
                  onClick={() => (!isUploading ? setSelectedCourse("MCA") : null)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 relative ${
                    selectedCourse === "MCA"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md"
                      : "border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30"
                  } ${isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base text-foreground">MCA Program</span>
                    {selectedCourse === "MCA" && (
                      <CheckCircle2 className="w-5 h-5 text-primary animate-in zoom-in" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Master of Computer Applications. Teams of <strong>1 to 2 students</strong>. Student topic suggestion workflow.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2: Download demo template & Telemetry Toggle */}
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 border border-border/80 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Official Demo Template Format
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Includes mandatory columns (Project TeamID, Enrollment Number, Student Name, etc.) and sample sheets.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDemo}
                  disabled={isUploading}
                  className="gap-1.5 text-xs whitespace-nowrap bg-background hover:bg-muted font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  Download Demo Format
                </Button>
              </div>

              {/* Real-time progress bar option toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/60 bg-card">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Real-Time Processing Telemetry
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Displays live progress bar, batch counters, and interactive stage tracking
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showProgressTelemetry}
                  disabled={isUploading}
                  onClick={() => setShowProgressTelemetry(!showProgressTelemetry)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    showProgressTelemetry ? "bg-primary" : "bg-input"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      showProgressTelemetry ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Step 3: File upload area */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-primary" />
                2. Select Excel File (.xlsx)
              </label>

              <div
                onDragEnter={!isUploading ? handleDrag : undefined}
                onDragLeave={!isUploading ? handleDrag : undefined}
                onDragOver={!isUploading ? handleDrag : undefined}
                onDrop={!isUploading ? handleDrop : undefined}
                onClick={() => (!isUploading ? fileInputRef.current?.click() : null)}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  isUploading
                    ? "border-primary/40 bg-muted/20 cursor-wait opacity-70"
                    : dragActive
                    ? "border-primary bg-primary/10"
                    : selectedFile
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/20"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB — Ready to process
                    </div>
                    {!isUploading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-xs text-destructive hover:bg-destructive/10 h-7"
                      >
                        Remove file
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      Click or drag Excel file here
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supported formats: .xlsx and .xls (Multi-sheet workbooks supported)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* LIVE PROGRESS BAR SECTION (Active during upload) */}
            {isUploading && showProgressTelemetry && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3.5 animate-in fade-in-50 duration-200">
                {/* Progress bar header with percentage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Processing Onboarding
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase bg-background">
                      {progress.stage}
                    </Badge>
                  </div>
                  <span className="text-sm font-extrabold font-mono text-primary">
                    {progress.percent}%
                  </span>
                </div>

                {/* Smooth 60fps Native Progress Bar (eliminates Radix Context useMemo churn) */}
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/20">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                  />
                </div>

                {/* Status Message and Detail */}
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary animate-spin" />
                    {progress.message || "Processing workbook..."}
                  </div>
                  {progress.detail && (
                    <div className="text-[11px] text-muted-foreground pl-5 font-mono">
                      {progress.detail}
                    </div>
                  )}
                </div>

                {/* 4-Step Pipeline Flow Indicator */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {PIPELINE_STEPS.map((step) => {
                    const status = getStepStatus(step.id);
                    const Icon = step.icon;
                    return (
                      <div
                        key={step.id}
                        className={`rounded-lg p-2 text-center border transition-all ${
                          status === "done"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                            : status === "active"
                            ? "bg-primary/15 border-primary text-primary font-semibold shadow-sm"
                            : "bg-muted/40 border-border text-muted-foreground opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-center mb-1">
                          {status === "done" ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Icon className={`w-3.5 h-3.5 ${status === "active" ? "animate-pulse" : ""}`} />
                          )}
                        </div>
                        <div className="text-[10px] font-medium leading-tight">{step.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Collapsible Live Log Box */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
                  >
                    <Terminal className="w-3 h-3 text-primary" />
                    <span>{showLogs ? "Hide Live Event Stream" : "View Live Event Stream"}</span>
                    {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showLogs && (
                    <div
                      ref={logContainerRef}
                      className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-zinc-950 p-2.5 font-mono text-[10px] text-zinc-300 border border-zinc-800 space-y-1"
                    >
                      {logEntries.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-zinc-500 select-none">[{log.time}]</span>
                          <span
                            className={
                              log.stage === "error"
                                ? "text-red-400"
                                : log.stage === "completed"
                                ? "text-emerald-400"
                                : "text-zinc-200"
                            }
                          >
                            {log.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Information notice regarding password policy */}
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Automated Security Provisioning:</strong> Each student account is created with username and initial password set to their enrollment number. On first login, access will be intercepted with a mandatory password reset dialog.
              </div>
            </div>
          </div>
        ) : (
          /* Post-import results view */
          <div className="space-y-5 py-2">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-800 dark:text-emerald-300 flex items-start space-x-3">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Processing Successful</h4>
                <p className="text-xs mt-0.5">{uploadResult.message}</p>
              </div>
            </div>

            {/* Summary metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-card border p-3 text-center">
                <div className="text-xs text-muted-foreground font-medium">Sheets Parsed</div>
                <div className="text-xl font-bold text-foreground mt-1 flex items-center justify-center gap-1">
                  <Layers className="w-4 h-4 text-primary" />
                  {uploadResult.totalSheetsParsed}
                </div>
              </div>

              <div className="rounded-lg bg-card border p-3 text-center">
                <div className="text-xs text-muted-foreground font-medium">Students</div>
                <div className="text-xl font-bold text-foreground mt-1 flex items-center justify-center gap-1">
                  <Users className="w-4 h-4 text-primary" />
                  {uploadResult.totalStudentsProcessed}
                </div>
              </div>

              <div className="rounded-lg bg-card border p-3 text-center">
                <div className="text-xs text-muted-foreground font-medium">Teams Created</div>
                <div className="text-xl font-bold text-foreground mt-1 flex items-center justify-center gap-1">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  {uploadResult.totalTeamsCreated}
                </div>
              </div>
            </div>

            {/* Processed sheets */}
            {uploadResult.sheetNames.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Processed Sheets:</label>
                <div className="flex flex-wrap gap-1.5">
                  {uploadResult.sheetNames.map((sheet) => (
                    <Badge key={sheet} variant="secondary" className="text-xs font-mono">
                      {sheet}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Teams summary */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Teams Formed ({uploadResult.teams.length}):
              </label>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background/50 divide-y divide-border text-xs">
                {uploadResult.teams.map((t) => (
                  <div key={t.teamId} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground">Team {t.teamId}</span>
                      <span className="text-muted-foreground ml-2">
                        ({t.studentCount} {t.studentCount === 1 ? "student" : "students"})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {t.enrollmentNumbers.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          {!uploadResult ? (
            <>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUploadAndProcess}
                disabled={!selectedFile || isUploading}
                className="gap-2 bg-primary text-primary-foreground font-semibold"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Processing ({progress.percent}%)...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Start Bulk Onboarding</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Upload Another File
              </Button>
              <Button type="button" onClick={handleClose} className="bg-primary text-primary-foreground">
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
