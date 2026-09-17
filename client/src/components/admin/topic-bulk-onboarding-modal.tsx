import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ITopicOnboardingResult } from "@shared/schema";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  XCircle,
  Hash,
  BookOpen,
  ArrowRight
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ITopicBulkOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TopicBulkOnboardingModal({ isOpen, onClose }: ITopicBulkOnboardingModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [course, setCourse] = useState<"BCA" | "MCA">("BCA");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ITopicOnboardingResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validExtensions = [".xlsx", ".xls"];
      const isExtensionValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isExtensionValid) {
        toast({
          title: "Invalid File Type",
          description: "Please select a valid Excel workbook (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Drag and drop handlers
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
      const validExtensions = [".xlsx", ".xls"];
      const isExtensionValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isExtensionValid) {
        toast({
          title: "Invalid File Type",
          description: "Please drop a valid Excel workbook (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Download official demo template
  const handleDownloadDemo = async () => {
    try {
      const response = await fetch("/api/admin/onboarding/topics/demo-template", {
        headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });

      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "APMS_Project_Topics_Suggestions_Demo_Format.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template Downloaded",
        description: "Official project suggestions format template downloaded successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Download Error",
        description: err.message || "Failed to download demo format",
        variant: "destructive",
      });
    }
  };

  // Submit bulk topic onboarding
  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("course", course);
      formData.append("autoApprove", "true");

      const response = await fetch("/api/admin/onboarding/topics/upload", {
        method: "POST",
        body: formData,
      });

      const data: ITopicOnboardingResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to process project suggestions file.");
      }

      setUploadResult(data);

      // Invalidate all topic-related queries using predicate matching.
      // Query keys include course params (e.g. "/api/topics/approved?course=BCA")
      // so exact key matching fails — predicate ensures all variants are refreshed.
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/topics') ||
            key.startsWith('/api/projects') ||
            key.startsWith('/api/stats')
          );
        },
      });

      toast({
        title: "Bulk Upload Complete",
        description: `Successfully provisioned ${data.totalTopicsCreated} topics across ${data.matchedSupervisors} verified supervisors.`,
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred during topic upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Reset modal state
  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleModalClose = () => {
    if (isUploading) return;
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Bulk Upload Project Topics</DialogTitle>
              <DialogDescription>
                Upload faculty project suggestions (.xlsx / .xls), cross-check supervisor records, and auto-assign sequential PUGID26xxx IDs.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!uploadResult ? (
          <div className="space-y-6 py-2">
            {/* Guidelines Banner */}
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs space-y-1 text-blue-900 dark:text-blue-200">
                  <p className="font-semibold text-sm">Automated Processing & Validation Rules:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      <strong>Supervisor Cross-Checking:</strong> The system verifies each row's Faculty Name and Email against existing supervisor accounts in PostgreSQL before inserting topics.
                    </li>
                    <li>
                      <strong>Auto-Incrementing PUGIDs:</strong> Topics for verified supervisors are automatically assigned sequential unique codes: <code className="bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded font-mono font-bold">PUGID26001</code>, <code className="bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded font-mono font-bold">PUGID26002</code>, etc.
                    </li>
                    <li>
                      <strong>Unmatched Rows Skipped:</strong> Any row where the supervisor is not found or details mismatch will be safely skipped and detailed in the post-upload failure report.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Course Program Selector */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <label className="text-sm font-medium text-foreground">Target Degree Program</label>
                <p className="text-xs text-muted-foreground">Select the student cohort for these project suggestions</p>
              </div>
              <div className="w-36">
                <Select value={course} onValueChange={(v: "BCA" | "MCA") => setCourse(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BCA">BCA Program</SelectItem>
                    <SelectItem value="MCA">MCA Program</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* File Dropzone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20"
                  : selectedFile
                  ? "border-green-500/80 bg-green-50/30 dark:bg-green-950/20"
                  : "border-muted-foreground/25 hover:border-purple-400 hover:bg-muted/40"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileChange}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose a different file
                  </p>
                  <Badge variant="outline" className="mt-1 bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300">
                    Ready for Validation & Upload
                  </Badge>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Drag and drop your project suggestions file here, or <span className="text-purple-600 dark:text-purple-400 underline font-semibold">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports Google Forms Excel exports (.xlsx or .xls)
                  </p>
                </div>
              )}
            </div>

            {/* Template Download Bar */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Need the exact Excel format?</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadDemo}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Demo Format</span>
              </Button>
            </div>
          </div>
        ) : (
          /* ================= POST-UPLOAD REPORT VIEW ================= */
          <div className="space-y-5 py-2">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border bg-muted/40 text-center">
                <p className="text-xs text-muted-foreground font-medium">Rows Processed</p>
                <p className="text-2xl font-bold text-foreground mt-1">{uploadResult.totalRows}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/40 dark:bg-green-950/20 text-center">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">Verified Faculty</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{uploadResult.matchedSupervisors}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 text-center">
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">Topics Uploaded</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{uploadResult.totalTopicsCreated}</p>
              </div>

              <div className={`p-3.5 rounded-xl border text-center ${
                uploadResult.unmatchedSupervisors > 0
                  ? "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                  : "border-muted bg-muted/20 text-muted-foreground"
              }`}>
                <p className="text-xs font-medium">Skipped / Failed</p>
                <p className={`text-2xl font-bold mt-1 ${uploadResult.unmatchedSupervisors > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                  {uploadResult.unmatchedSupervisors}
                </p>
              </div>
            </div>

            {/* Generated ID Range Badge */}
            {uploadResult.generatedIdRange && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-purple-200 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-foreground">Generated Sequential Unique ID Range:</span>
                </div>
                <div className="flex items-center gap-2 font-mono font-bold text-xs">
                  <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300">
                    {uploadResult.generatedIdRange.start}
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300">
                    {uploadResult.generatedIdRange.end}
                  </Badge>
                </div>
              </div>
            )}

            {/* Tabbed Reports: Failure Report & Verified Topics */}
            <Tabs defaultValue={uploadResult.unmatchedSupervisors > 0 ? "failures" : "success"}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="success" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span>Verified Faculty ({uploadResult.successRecords.length})</span>
                </TabsTrigger>
                <TabsTrigger value="failures" className="gap-1.5">
                  <AlertTriangle className={`h-3.5 w-3.5 ${uploadResult.unmatchedSupervisors > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                  <span>Failure Report ({uploadResult.failureRecords.length})</span>
                </TabsTrigger>
              </TabsList>

              {/* SUCCESS RECORDS VIEW */}
              <TabsContent value="success" className="space-y-3 mt-3">
                <div className="max-h-72 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Row</TableHead>
                        <TableHead>Faculty Name & Email</TableHead>
                        <TableHead>Emp. ID</TableHead>
                        <TableHead>Generated Topics & PUGIDs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadResult.successRecords.map((rec) => (
                        <TableRow key={rec.rowNumber} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-xs font-semibold">{rec.rowNumber}</TableCell>
                          <TableCell>
                            <p className="font-medium text-xs text-foreground">{rec.facultyName}</p>
                            <p className="text-[11px] text-muted-foreground">{rec.facultyEmail}</p>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {rec.empId || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {rec.topicCodes.map((code, idx) => (
                                <Badge
                                  key={code}
                                  variant="outline"
                                  className="text-[10px] font-mono bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                                  title={rec.topicTitles[idx] || code}
                                >
                                  {code}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* FAILURE REPORT VIEW (CRITICAL USER REQUIREMENT) */}
              <TabsContent value="failures" className="space-y-3 mt-3">
                {uploadResult.failureRecords.length > 0 ? (
                  <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-xs font-semibold">
                      <XCircle className="h-4 w-4 shrink-0" />
                      <span>The following faculty records could not be verified in the PostgreSQL database and were skipped:</span>
                    </div>

                    <div className="max-h-72 overflow-y-auto rounded-lg border bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-14">Row #</TableHead>
                            <TableHead>Faculty Name (Excel)</TableHead>
                            <TableHead>Faculty Email</TableHead>
                            <TableHead>Failure Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadResult.failureRecords.map((fail, idx) => (
                            <TableRow key={idx} className="hover:bg-red-50/20 dark:hover:bg-red-950/20">
                              <TableCell className="font-mono text-xs font-semibold text-red-600">
                                {fail.rowNumber}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-foreground">
                                {fail.facultyName}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {fail.facultyEmail}
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive" className="text-[11px] font-normal py-0.5">
                                  {fail.reason}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-xl border border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/10">
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="font-semibold text-foreground text-sm">Zero Validation Failures</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All faculty names and emails extracted from the file perfectly matched registered supervisor accounts.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          {!uploadResult ? (
            <>
              <Button variant="ghost" onClick={handleModalClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleUploadSubmit}
                disabled={!selectedFile || isUploading}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isUploading ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    <span>Validating & Inserting Topics...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    <span>Upload & Validate Topics</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleReset} className="gap-1.5 text-xs">
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Upload Another Sheet</span>
              </Button>
              <Button onClick={handleModalClose} className="bg-purple-600 hover:bg-purple-700 text-white">
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
