import { Express, Router } from "express";
import { createServer, type Server } from "http";
import { DBStorage } from "../db-storage";

import { registerAuthRoutes } from "./auth";
import { registerUserRoutes } from "./users";
import { registerStatsRoutes } from "./stats";
import { registerProjectRoutes } from "./projects";
import { registerTopicRoutes } from "./topics";
import { registerGroupRoutes } from "./groups";
import { registerAdminRoutes } from "./admin";

export async function registerRoutes(app: Express, storage: DBStorage): Promise<Server> {
    const router = Router();

    registerAuthRoutes(router, storage);
    registerUserRoutes(router, storage);
    registerStatsRoutes(router, storage);
    registerProjectRoutes(router, storage);
    registerTopicRoutes(router, storage);
    registerGroupRoutes(router, storage);
    registerAdminRoutes(router, storage);

    app.use(router);

    const httpServer = createServer(app);
    return httpServer;
}
