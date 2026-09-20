import { Request, Response } from "express";
import {
  postNoteService,
  getNotesService,
  getOneNoteService,
  deleteNoteService,
  updateNoteService,
  toggleFavoriteService,
} from "../services/notes.service";
import { apiErrors } from "../utils/apiErrors";
import { parseId } from "../utils/parseId";
import { userIdOf } from "../utils/request";

// Express 5 сам передаёт отклонённые промисы в errorHandler — try/catch не нужен

export const postNoteController = async (req: Request, res: Response) => {
  const result = await postNoteService(req.body, userIdOf(req));

  res.status(201).json({ message: "Note created successfully", data: result });
};

export const getNotesController = async (req: Request, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const result = await getNotesService(userIdOf(req), search);

  res.status(200).json({ message: "Notes received successfully", data: result });
};

export const getOneNoteController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await getOneNoteService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Note not found");

  res.status(200).json({ message: "Note by id received successfully", data: result });
};

export const deleteNoteController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await deleteNoteService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Note not found");

  res.status(200).json({ message: "Note deleted successfully", data: result });
};

export const updateNoteController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await updateNoteService(parseId(req.params.id), req.body, userIdOf(req));
  if (!result) throw apiErrors.notFound("Note not found");

  res.status(200).json({ message: "Note updated successfully", data: result });
};

export const toggleFavoriteController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await toggleFavoriteService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Note not found");

  res.status(200).json({
    message: result.is_favorite ? "Note added to favorites" : "Note removed from favorites",
    data: result,
  });
};
