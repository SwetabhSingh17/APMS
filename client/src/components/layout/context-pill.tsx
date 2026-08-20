import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Loader2, Bell, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TOAST_DISPLAY_DURATION = 4000;

export function ContextPill() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [status, setStatus] = useState<"idle" | "syncing" | "notification" | "success" | "toast">("idle");
  const [message, setMessage] = useState("");
  const [subMessage, setSubMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<string | undefined>(undefined);
  const { toasts, dismiss } = useToast();
  const processedToastIds = useRef<Set<string>>(new Set());
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Process incoming toasts — show them one at a time in the pill, then auto-dismiss
  useEffect(() => {
    const unprocessedToast = toasts.find(t => !processedToastIds.current.has(t.id));

    if (unprocessedToast) {
      // Mark as processed so we don't re-show it
      processedToastIds.current.add(unprocessedToast.id);

      setStatus("toast");
      setMessage(String(unprocessedToast.title || "Notification"));
      setSubMessage(String(unprocessedToast.description || ""));
      setToastVariant(unprocessedToast.variant);

      // Clear any existing dismiss timer
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      // Auto-dismiss the toast from the global state and collapse the pill
      dismissTimerRef.current = setTimeout(() => {
        dismiss(unprocessedToast.id);
        setStatus("idle");
        setSubMessage("");
        setToastVariant(undefined);
      }, TOAST_DISPLAY_DURATION);
    }
  }, [toasts, dismiss]);

  // Syncing state from react-query
  useEffect(() => {
    // Don't interrupt a toast being displayed
    if (status === "toast") return;

    if (isFetching > 0 || isMutating > 0) {
      setStatus("syncing");
      setMessage("Syncing...");
      setSubMessage("");
    } else if (status === "syncing") {
      setStatus("success");
      setMessage("Synced");

      const timer = setTimeout(() => {
        setStatus("idle");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isFetching, isMutating, status]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setStatus("idle");
    setSubMessage("");
    setToastVariant(undefined);
  }, []);

  const isDestructive = toastVariant === "destructive";

  return (
    <div className="flex items-center justify-center mx-4">
      <motion.div
        layout
        initial={{ borderRadius: 32 }}
        animate={{
          width: status === "idle" ? 8 : "auto",
          height: status === "idle" ? 8 : subMessage ? 48 : 32,
          paddingLeft: status === "idle" ? 0 : 16,
          paddingRight: status === "idle" ? 0 : 16,
          opacity: status === "idle" ? 0.3 : 1,
        }}
        transition={{ type: "spring", stiffness: 100, damping: 25 }}
        className={`flex items-center justify-center overflow-hidden backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border cursor-pointer
          ${status === "idle"
            ? "bg-foreground border-transparent pointer-events-none"
            : status === "toast" && isDestructive
              ? "bg-destructive/10 dark:bg-destructive/20 border-destructive/30"
              : "bg-background/80 dark:bg-black/60 border-white/20 pointer-events-auto"
          }
        `}
        onClick={status !== "idle" ? handleDismiss : undefined}
      >
        <AnimatePresence mode="wait">
          {status !== "idle" && (
            <motion.div
              key={status + message}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {/* Icon */}
              {status === "syncing" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
              {status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {status === "notification" && (
                <div className="relative">
                  <Bell className="w-3.5 h-3.5 text-blue-500" />
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                </div>
              )}
              {status === "toast" && (
                isDestructive ? (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                ) : (
                  <div className="relative">
                    <Bell className="w-3.5 h-3.5 text-primary" />
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  </div>
                )
              )}

              {/* Content */}
              <div className="flex flex-col">
                <span className={`text-xs font-semibold tracking-wide truncate max-w-[280px] ${isDestructive && status === "toast" ? "text-destructive" : "text-foreground"}`}>
                  {message}
                </span>
                {subMessage && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                    {subMessage}
                  </span>
                )}
              </div>

              {/* Dismiss button for toasts */}
              {status === "toast" && (
                <X className="w-3 h-3 ml-1 text-muted-foreground hover:text-foreground transition-colors" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
