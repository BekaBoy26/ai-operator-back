import { Request, Response } from "express";
import {
  postContactService,
  getContactsService,
  getOneContactService,
  deleteContactService,
  updateContactService,
} from "../services/contacts.service";
import { apiErrors } from "../utils/apiErrors";
import { parseId } from "../utils/parseId";
import { userIdOf } from "../utils/request";

export const postContactController = async (req: Request, res: Response) => {
  const result = await postContactService(req.body, userIdOf(req));

  res.status(201).json({ message: "Contact created successfully", data: result });
};

export const getContactsController = async (req: Request, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const result = await getContactsService(userIdOf(req), search);

  res.status(200).json({ message: "Contacts received successfully", data: result });
};

export const getOneContactController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await getOneContactService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Contact not found");

  res.status(200).json({ message: "Contact by id received successfully", data: result });
};

export const deleteContactController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await deleteContactService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Contact not found");

  res.status(200).json({ message: "Contact deleted successfully", data: result });
};

export const updateContactController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await updateContactService(parseId(req.params.id), req.body, userIdOf(req));
  if (!result) throw apiErrors.notFound("Contact not found");

  res.status(200).json({ message: "Contact updated successfully", data: result });
};
