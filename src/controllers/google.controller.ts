import { Request, Response } from "express";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from "../services/calendar.service";
import { getDriveFiles } from "../services/drive.service";
import {
  getGmailMessage,
  listGmailMessages,
  modifyGmailMessage,
  sendGmailMessage,
} from "../services/gmail.service";
import { userIdOf } from "../utils/request";

// ── Calendar ──

export const getCalendarController = async (req: Request, res: Response) => {
  const events = await getCalendarEvents(userIdOf(req), res.locals.query);

  res.status(200).json({ message: "Calendar events", data: events });
};

export const postCalendarController = async (req: Request, res: Response) => {
  const event = await createCalendarEvent(userIdOf(req), req.body);

  res.status(201).json({ message: "Event created", data: event });
};

export const updateCalendarController = async (req: Request<{ id: string }>, res: Response) => {
  const event = await updateCalendarEvent(userIdOf(req), req.params.id, req.body);

  res.status(200).json({ message: "Event updated", data: event });
};

export const deleteCalendarController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await deleteCalendarEvent(userIdOf(req), req.params.id);

  res.status(200).json({ message: "Event deleted", data: result });
};

// ── Drive ──

export const getDriveController = async (req: Request, res: Response) => {
  const files = await getDriveFiles(userIdOf(req));

  res.status(200).json({ message: "Drive files", data: files });
};

// ── Gmail ──

export const getGmailController = async (req: Request, res: Response) => {
  const { messages, nextPageToken } = await listGmailMessages(userIdOf(req), res.locals.query);

  res.status(200).json({ message: "Gmail messages", data: messages, nextPageToken });
};

export const getGmailMessageController = async (req: Request<{ id: string }>, res: Response) => {
  const message = await getGmailMessage(userIdOf(req), req.params.id);

  res.status(200).json({ message: "Gmail message", data: message });
};

export const sendGmailMessageController = async (req: Request, res: Response) => {
  const sent = await sendGmailMessage(userIdOf(req), req.body);

  res.status(200).json({ message: "Message sent", data: sent });
};

export const modifyGmailMessageController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await modifyGmailMessage(userIdOf(req), req.params.id, req.body.action);

  res.status(200).json({ message: "Message updated", data: result });
};
