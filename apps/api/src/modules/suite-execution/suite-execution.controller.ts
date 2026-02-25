import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
  ServiceError,
  suiteExecutionService,
} from "./suite-execution.service";

const getErrorPayload = (error: unknown): { statusCode: number; message: string } => {
  const err = error as ServiceError;
  return {
    statusCode: Number(err?.statusCode || 500),
    message: err?.message || "Suite execution operation failed",
  };
};

export const suiteExecutionController = {
  async executeSuite(req: AuthRequest, res: Response) {
    try {
      const data = await suiteExecutionService.executeSuite({
        suiteId: req.params.suiteId,
        runId: req.params.runId,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.status(201).json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async updateExecutionStatus(req: AuthRequest, res: Response) {
    try {
      const data = await suiteExecutionService.updateExecutionStatus({
        executionId: req.params.id,
        status: req.body.status,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async bulkMark(req: AuthRequest, res: Response) {
    try {
      const data = await suiteExecutionService.bulkMark({
        suiteId: req.params.suiteId,
        runId: req.params.runId,
        status: req.body.status,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async reset(req: AuthRequest, res: Response) {
    try {
      const data = await suiteExecutionService.reset({
        suiteId: req.params.suiteId,
        runId: req.params.runId,
        mode: req.body.mode,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async sync(req: AuthRequest, res: Response) {
    try {
      const data = await suiteExecutionService.sync({
        suiteId: req.params.suiteId,
        runId: req.params.runId,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async summary(req: AuthRequest, res: Response) {
    try {
      const data = await suiteExecutionService.summary({
        runId: req.params.runId,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },
};
