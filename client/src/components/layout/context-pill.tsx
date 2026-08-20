import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Loader2, Bell, CheckCircle2 } from "lucide-react";

export function ContextPill() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [status, setStatus] = useState<"idle" | "syncing" | "notification" | "success">("idle");
  const [message, setMessage] = useState("");
  
  useEffect(() => {
    if (isFetching > 0 || isMutating > 0) {
      setStatus("syncing");
      setMessage("Syncing State...");
    } else if (status === "syncing") {
      setStatus("success");
      setMessage("Synced");
      
      const timer = setTimeout(() => {
        setStatus("idle");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isFetching, isMutating]);

  // Simulate a random incoming notification for demonstration of the Spatial OS feel
  useEffect(() => {
    const interval = setInterval(() => {
      if (status === "idle" && Math.random() > 0.7) {
        setStatus("notification");
        setMessage("New System Alert");
        setTimeout(() => {
          setStatus("idle");
        }, 4000);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="flex items-center justify-center pointer-events-none mx-4">
      <motion.div
        layout
        initial={{ borderRadius: 32 }}
        animate={{
          width: status === "idle" ? 8 : "auto",
          height: status === "idle" ? 8 : 32,
          paddingLeft: status === "idle" ? 0 : 16,
          paddingRight: status === "idle" ? 0 : 16,
          opacity: status === "idle" ? 0.3 : 1,
        }}
        transition={{ type: "spring", stiffness: 100, damping: 25 }}
        className={`flex items-center justify-center overflow-hidden backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-white/20 
          ${status === "idle" ? "bg-foreground" : "bg-background/80 dark:bg-black/60"}
        `}
      >
        <AnimatePresence mode="wait">
          {status !== "idle" && (
            <motion.div
              key={status}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {status === "syncing" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
              {status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {status === "notification" && (
                <div className="relative">
                  <Bell className="w-3.5 h-3.5 text-blue-500" />
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                </div>
              )}
              <span className="text-xs font-medium text-foreground tracking-wide">
                {message}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
