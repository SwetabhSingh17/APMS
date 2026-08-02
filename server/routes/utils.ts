import { Request } from "express";
import { User } from "@shared/schema";

export function isAuthenticatedRequest(req: Request): req is Request & { user: User } {
    return req.isAuthenticated() && req.user !== undefined;
}
