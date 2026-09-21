import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema, UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Info, Lock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  // Enrollment number is required for student accounts
  if (data.role === UserRole.STUDENT) {
    if (!data.enrollmentNumber) return false;
  }
  return true;
}, {
  message: "Enrollment number is required for student registration",
  path: ["enrollmentNumber"]
}).refine((data) => {
  // Course is required for student accounts
  if (data.role === UserRole.STUDENT) {
    if (!data.course) return false;
  }
  return true;
}, {
  message: "Course selection is required for students",
  path: ["course"]
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

// Frontend registration lock: Set to true when registrations need to be reopened at a later date
const IS_REGISTRATION_OPEN = false;

export default function AuthPage() {
  const [_, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      email: "",
      role: UserRole.STUDENT,
      enrollmentNumber: "",
      course: "BCA",
    },
  });

  // Handle registration errors
  useEffect(() => {
    if (registerMutation.error) {
      const error = registerMutation.error as Error;
      if (error.message.includes("enrollment number is already registered")) {
        registerForm.setError("enrollmentNumber", {
          type: "manual",
          message: "This enrollment number is already registered",
        });
      }
    }
  }, [registerMutation.error, registerForm]);

  // Reset login mutation error on input change
  const loginUsername = loginForm.watch("username");
  const loginPassword = loginForm.watch("password");
  useEffect(() => {
    if (loginMutation.error) {
      loginMutation.reset();
    }
  }, [loginUsername, loginPassword]);

  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    const { confirmPassword, ...userData } = data;
    registerMutation.mutate(userData);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-50/70 dark:bg-slate-950">
      <div className="w-full max-w-md flex flex-col items-center my-auto">
        {/* Department Logo above login box */}
        <div className="w-full mb-5 flex justify-center">
          <div className="w-full rounded-xl overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800 bg-white">
            <img
              src="/Department_Logo.png"
              alt="Department of Computer Application, Integral University"
              className="w-full h-auto block rounded-xl"
            />
          </div>
        </div>

        <Card className="w-full shadow-md border-border/80 bg-card">
          <CardHeader className="space-y-2 pb-4 text-center">
            <div className="flex justify-center">
              <span className="text-xs sm:text-sm font-bold tracking-wider text-primary bg-primary/10 border border-primary/20 px-3 py-0.5 rounded-full">
                ( I.U.A.P.M.P )
              </span>
            </div>
            <h1 className="font-bold text-primary text-lg sm:text-xl tracking-tight leading-snug">
              Integral University Academic Project Management Portal
            </h1>
            <p className="text-sm font-semibold text-foreground/90">
              Department of Computer Application
            </p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              INTEGRAL UNIVERSITY
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger
                  value="register"
                  onClick={() => {
                    if (!IS_REGISTRATION_OPEN) {
                      toast({
                        title: "Registrations Closed",
                        description: "Registrations are closed as of now, Teams have already been allotted.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    {loginMutation.error && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive font-medium flex items-center justify-between gap-2">
                        <span>{loginMutation.error.message}</span>
                        {(loginMutation.error as any).code && (
                          <span className="text-[10px] font-mono bg-destructive/20 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                            {(loginMutation.error as any).code}
                          </span>
                        )}
                      </div>
                    )}
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Logging in..." : "Login"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register" className="relative min-h-[440px]">
                {!IS_REGISTRATION_OPEN && (
                  <div
                    role="alert"
                    onClick={() => {
                      toast({
                        title: "Registrations Closed",
                        description: "Registrations are closed as of now, Teams have already been allotted.",
                        variant: "destructive",
                      });
                    }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-background/85 backdrop-blur-sm rounded-xl border border-border/80 cursor-pointer select-none shadow-sm transition-all hover:bg-background/90 group"
                    title="Click for notice details"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 shadow-inner group-hover:scale-105 transition-transform">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-base sm:text-lg text-foreground mb-1.5">
                      Registrations Closed
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-xs leading-relaxed font-medium">
                      Registrations are closed as of now, Teams have already been allotted.
                    </p>
                    <div className="mt-4 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-[11px] font-medium flex items-center gap-1.5">
                      <span>Please contact your department coordinator</span>
                    </div>
                  </div>
                )}

                <div className={!IS_REGISTRATION_OPEN ? "pointer-events-none opacity-20 filter blur-[0.5px] select-none" : ""}>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="First name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Last name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Enter your email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Create a username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={UserRole.STUDENT}>Student</SelectItem>
                                  <SelectItem value={UserRole.SUPERVISOR}>Supervisor</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                      </div>
                      {/* Show enrollment number field for students */}
                      {registerForm.watch("role") === UserRole.STUDENT && (
                        <>
                          <FormField
                            control={registerForm.control}
                            name="course"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Course</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value || "BCA"}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select course" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="BCA">BCA</SelectItem>
                                    <SelectItem value="MCA">MCA</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="enrollmentNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Enrollment Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter your enrollment number" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                                <FormDescription>
                                  Required for student registration
                                </FormDescription>
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Create a password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirm your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Registering..." : "Register"}
                      </Button>
                    </form>
                  </Form>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Attribution */}
        <footer className="mt-8 text-center text-xs text-muted-foreground space-y-1">
          <p className="tracking-wide">
            ❤️ Powered By : <span className="font-semibold text-foreground">Binary Battalion.ai ❤️</span>
          </p>
          <p className="tracking-wide">
            💻 Designed and Developed by : <span className="font-semibold text-foreground">SWETABH SINGH 💻 </span>
          </p>
        </footer>
      </div>
    </div>
  );
}
