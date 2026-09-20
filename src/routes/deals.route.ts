import { Router } from "express";
import {
  postDealController,
  getDealsController,
  getOneDealController,
  deleteDealController,
  updateDealController,
  updateDealStageController,
} from "../controllers/deals.controller";
import { validateSchema } from "../middlewares/schema";
import {
  createDealSchema,
  updateDealSchema,
  updateDealStageSchema,
} from "../schemas/deals.schema";
import { authMiddleware } from "../middlewares/auth";

const router = Router();
router.post(
  "/",
  authMiddleware,
  validateSchema(createDealSchema),
  postDealController,
);
router.get("/", authMiddleware, getDealsController);
router.get("/:id", authMiddleware, getOneDealController);
router.delete("/:id", authMiddleware, deleteDealController);
router.patch(
  "/:id",
  authMiddleware,
  validateSchema(updateDealSchema),
  updateDealController,
);
router.patch(
  "/:id/stage",
  authMiddleware,
  validateSchema(updateDealStageSchema),
  updateDealStageController,
);

export default router;
