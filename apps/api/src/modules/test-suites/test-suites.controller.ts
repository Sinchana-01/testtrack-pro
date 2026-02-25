import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { ServiceError, testSuitesService } from "./test-suites.service";

const getErrorPayload = (error: unknown): { statusCode: number; message: string } => {
  const err = error as ServiceError;
  return {
    statusCode: Number(err?.statusCode || 500),
    message: err?.message || "Suite operation failed",
  };
};

export const testSuitesController = {
  async addTestCases(req: AuthRequest, res: Response) {
    try {
      const refs = Array.isArray(req.body.testCaseIds) ? req.body.testCaseIds : [];
      const result = await testSuitesService.addTestCases({
        suiteId: req.params.id,
        refs,
        actorRole: req.user!.role,
        actorId: req.user!.userId,
      });
      return res.json(result);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async removeTestCase(req: AuthRequest, res: Response) {
    try {
      const result = await testSuitesService.removeTestCase({
        suiteId: req.params.id,
        testCaseRef: req.params.testCaseId,
        actorId: req.user!.userId,
      });
      return res.json(result);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async reorder(req: AuthRequest, res: Response) {
    try {
      const refs = Array.isArray(req.body.testCaseIds) ? req.body.testCaseIds : [];
      const result = await testSuitesService.reorderTestCases({
        suiteId: req.params.id,
        refs,
        actorId: req.user!.userId,
      });
      return res.json(result);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async clone(req: AuthRequest, res: Response) {
    try {
      const result = await testSuitesService.cloneSuite({
        suiteId: req.params.id,
        actorId: req.user!.userId,
      });
      return res.status(201).json(result);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async archive(req: AuthRequest, res: Response) {
    try {
      const result = await testSuitesService.archiveSuite({ suiteId: req.params.id, actorId: req.user!.userId });
      return res.json(result);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },

  async restore(req: AuthRequest, res: Response) {
    try {
      const result = await testSuitesService.restoreSuite({ suiteId: req.params.id, actorId: req.user!.userId });
      return res.json(result);
    } catch (error) {
      const payload = getErrorPayload(error);
      return res.status(payload.statusCode).json({ message: payload.message });
    }
  },
};
