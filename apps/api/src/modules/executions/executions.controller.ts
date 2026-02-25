import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { ServiceError, executionsService } from "./executions.service";

const getErrorPayload = (error: unknown): { statusCode: number; message: string } => {
  const err = error as ServiceError;
  return {
    statusCode: Number(err?.statusCode || 500),
    message: err?.message || "Execution operation failed",
  };
};

export const executionsController = {
  async start(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.start({
        testCaseId: req.body.testCaseId,
        testRunId: req.body.testRunId,
        notes: req.body.notes,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.status(201).json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async saveStep(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.saveStep({
        executionId: req.params.id,
        stepNumber: Number(req.body.stepNumber),
        status: req.body.status,
        actualResult: req.body.actualResult,
        notes: req.body.notes,
        evidence: req.body.evidence,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async finalize(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.finalize({
        executionId: req.params.id,
        notes: req.body.notes,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async reExecute(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.reExecute({
        executionId: req.params.id,
        notes: req.body.notes,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.status(201).json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async createBug(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.createBug({
        executionId: req.params.id,
        stepNumber: Number(req.body.stepNumber),
        environment: req.body.environment,
        severity: req.body.severity,
        assignedTo: req.body.assignedTo,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.status(201).json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async timerStart(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.timerStart({
        executionId: req.params.id,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async timerPause(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.timerPause({
        executionId: req.params.id,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async timerResume(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.timerResume({
        executionId: req.params.id,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async timerStop(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.timerStop({
        executionId: req.params.id,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async setManualTime(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.setManualTime({
        executionId: req.params.id,
        durationSeconds: Number(req.body.durationSeconds),
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async history(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.history({
        executionId: req.params.id,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
      return res.json(data);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async compare(req: AuthRequest, res: Response) {
    try {
      const data = await executionsService.compare({
        executionId: req.params.id,
        compareToExecutionId: req.params.compareToId,
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
