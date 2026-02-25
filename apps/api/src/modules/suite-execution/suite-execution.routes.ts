import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { suiteExecutionController } from "./suite-execution.controller";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(Role.TESTER, Role.ADMIN, Role.DEVELOPER));

router.post(
  "/suite/:suiteId/run/:runId/execute",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  suiteExecutionController.executeSuite
);
router.patch(
  "/execution/:id",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  suiteExecutionController.updateExecutionStatus
);
router.post(
  "/suite/:suiteId/run/:runId/mark",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  suiteExecutionController.bulkMark
);
router.post(
  "/suite/:suiteId/run/:runId/reset",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  suiteExecutionController.reset
);
router.post(
  "/suite/:suiteId/run/:runId/sync",
  authorizeRoles(Role.TESTER, Role.ADMIN),
  suiteExecutionController.sync
);
router.get(
  "/testruns/:runId/summary",
  authorizeRoles(Role.TESTER, Role.ADMIN, Role.DEVELOPER),
  suiteExecutionController.summary
);

export default router;
