import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  getPreferences,
  listNotifications,
  markAllRead,
  markOneRead,
  updatePreferences,
} from "./notification.controller";

const router = Router();

router.use(authenticate);

router.get("/notifications", listNotifications);
router.patch("/notifications/:id/read", markOneRead);
router.patch("/notifications/read-all", markAllRead);

router.get("/notification-preferences", getPreferences);
router.put("/notification-preferences", updatePreferences);

// Backward-compat endpoints used by existing frontend bell.
router.get("/notifications/bugs", listNotifications);
router.patch("/notifications/bugs/:id/read", markOneRead);

export default router;
