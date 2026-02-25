import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { testSuitesController } from "./test-suites.controller";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(Role.TESTER, Role.ADMIN));

router.put("/test-suites/:id/add", testSuitesController.addTestCases);
router.put("/test-suites/:id/remove/:testCaseId", testSuitesController.removeTestCase);
router.put("/test-suites/:id/reorder", testSuitesController.reorder);
router.post("/test-suites/:id/clone", testSuitesController.clone);
router.put("/test-suites/:id/archive", testSuitesController.archive);
router.put("/test-suites/:id/restore", testSuitesController.restore);

export default router;
