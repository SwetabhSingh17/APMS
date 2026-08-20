import React, { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

type CourseFilter = "all" | "BCA" | "MCA";

interface CourseFilterContextType {
  courseFilter: CourseFilter;
  setCourseFilter: (filter: CourseFilter) => void;
  // Helper to append ?course= to API queries
  getCourseQuery: () => string;
}

const CourseFilterContext = createContext<CourseFilterContextType | undefined>(undefined);

export function CourseFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");

  const getCourseQuery = () => {
    // Only apply for roles that can filter
    if (user && [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.SUPERVISOR].includes(user.role as UserRole)) {
      if (courseFilter !== "all") {
        return `course=${courseFilter}`;
      }
    }
    return "";
  };

  return (
    <CourseFilterContext.Provider value={{ courseFilter, setCourseFilter, getCourseQuery }}>
      {children}
    </CourseFilterContext.Provider>
  );
}

export function useCourseFilter() {
  const context = useContext(CourseFilterContext);
  if (context === undefined) {
    throw new Error("useCourseFilter must be used within a CourseFilterProvider");
  }
  return context;
}
