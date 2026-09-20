import { Request, Response } from "express";
import {
  postDealService,
  getDealsService,
  getOneDealService,
  deleteDealService,
  updateDealService,
  updateDealStageService,
} from "../services/deals.service";
import { apiErrors } from "../utils/apiErrors";
import { parseId } from "../utils/parseId";
import { userIdOf } from "../utils/request";

export const postDealController = async (req: Request, res: Response) => {
  const result = await postDealService(req.body, userIdOf(req));

  res.status(201).json({ message: "Deal created successfully", data: result });
};

export const getDealsController = async (req: Request, res: Response) => {
  const result = await getDealsService(userIdOf(req));

  res.status(200).json({ message: "Deals received successfully", data: result });
};

export const getOneDealController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await getOneDealService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Deal not found");

  res.status(200).json({ message: "Deal by id received successfully", data: result });
};

export const deleteDealController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await deleteDealService(parseId(req.params.id), userIdOf(req));
  if (!result) throw apiErrors.notFound("Deal not found");

  res.status(200).json({ message: "Deal deleted successfully", data: result });
};

export const updateDealController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await updateDealService(parseId(req.params.id), req.body, userIdOf(req));
  if (!result) throw apiErrors.notFound("Deal not found");

  res.status(200).json({ message: "Deal updated successfully", data: result });
};

export const updateDealStageController = async (req: Request<{ id: string }>, res: Response) => {
  const result = await updateDealStageService(
    parseId(req.params.id),
    req.body.stage,
    userIdOf(req),
  );
  if (!result) throw apiErrors.notFound("Deal not found");

  res.status(200).json({ message: "Deal stage updated successfully", data: result });
};
