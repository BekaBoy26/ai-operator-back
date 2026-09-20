import { Request, Response } from "express";
import {
  postTaskService,
  getTasksService,
  getOneTaskService,
  deleteTaskService,
  updateTaskService,
  updateTaskStatusService,
} from "../services/tasks.service";
import { apiErrors } from "../utils/apiErrors";
import { parseId } from "../utils/parseId";
import { userIdOf } from "../utils/request";

export const postTaskController = async (req: Request, res: Response) => {
  const result = await postTaskService(req.body, userIdOf(req));

  res.status(201).json({ message: "Task created successfully", data: result });
};

export const getTasksController = async (req: Request, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const result = await getTasksService(userIdOf(req), status);

  res.status(200).json({ message: "Tasks received successfully", data: result });
};

export const getOneTaskController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await getOneTaskService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Task not found");

  res.status(200).json({ message: "Task by id received successfully", data: result });
};

export const deleteTaskController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await deleteTaskService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Task not found");

  res.status(200).json({ message: "Task deleted successfully", data: result });
};

export const updateTaskController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await updateTaskService(parseId(req.params.id), req.body, userIdOf(req));
  if (!result) throw apiErrors.notFound("Task not found");

  res.status(200).json({ message: "Task updated successfully", data: result });
};

export const updateTaskStatusController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await updateTaskStatusService(
    parseId(req.params.id),
    req.body.status,
    userIdOf(req),
  );
  if (!result) throw apiErrors.notFound("Task not found");

  res.status(200).json({ message: "Task status updated successfully", data: result });
};
