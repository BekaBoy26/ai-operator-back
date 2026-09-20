import { Router } from "express";
import {
  postTaskController,
  getTasksController,
  getOneTaskController,
  deleteTaskController,
  updateTaskController,
  updateTaskStatusController,
} from "../controllers/tasks.controller";
import { validateSchema } from "../middlewares/schema";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../schemas/tasks.schema";
import { authMiddleware } from "../middlewares/auth";

const router = Router();
router.post(
  "/",
  authMiddleware,
  validateSchema(createTaskSchema),
  postTaskController,
);
router.get("/", authMiddleware, getTasksController);
router.get("/:id", authMiddleware, getOneTaskController);
router.delete("/:id", authMiddleware, deleteTaskController);
router.patch(
  "/:id",
  authMiddleware,
  validateSchema(updateTaskSchema),
  updateTaskController,
);
router.patch(
  "/:id/status",
  authMiddleware,
  validateSchema(updateTaskStatusSchema),
  updateTaskStatusController,
);

export default router;
