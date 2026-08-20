import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

type AuthSplashProps = {
  isVisible: boolean;
  type: "login" | "logout" | "idle";
  username?: string;
};

export function AuthSplash({ isVisible, type, username }: AuthSplashProps) {
  return (
    <AnimatePresence>
      {isVisible && type !== "idle" && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(24px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60"
        >
          <div className="flex flex-col items-center justify-center space-y-6 text-foreground">
            {type === "login" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 100, damping: 20 }}
                className="text-center"
              >
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  WELCOME_{username?.toUpperCase()}
                </h1>
                <div className="mt-8 flex justify-center">
                  <div className="w-16 h-1 bg-primary/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 20 }}
                className="flex flex-col items-center space-y-4"
              >
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <h2 className="text-2xl font-bold tracking-widest text-muted-foreground">
                  LOGGING_OUT
                </h2>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
