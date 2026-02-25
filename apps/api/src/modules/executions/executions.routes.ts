import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { executionsController } from "./executions.controller";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(Role.TESTER, Role.ADMIN));

router.post("/executions/start", executionsController.start);
router.put("/executions/:id/step", executionsController.saveStep);
router.post("/executions/:id/timer/start", executionsController.timerStart);
router.post("/executions/:id/timer/pause", executionsController.timerPause);
router.post("/executions/:id/timer/resume", executionsController.timerResume);
router.post("/executions/:id/timer/stop", executionsController.timerStop);
router.put("/executions/:id/timer/manual-time", executionsController.setManualTime);
router.post("/executions/:id/finalize", executionsController.finalize);
router.post("/executions/:id/re-execute", executionsController.reExecute);
router.get("/executions/:id/history", executionsController.history);
router.get("/executions/:id/compare/:compareToId", executionsController.compare);
router.post("/executions/:id/create-bug", executionsController.createBug);

export default router;
