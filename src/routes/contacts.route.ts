import { Router } from "express";
import {
  postContactController,
  getContactsController,
  getOneContactController,
  deleteContactController,
  updateContactController,
} from "../controllers/contacts.controller";
import { validateSchema } from "../middlewares/schema";
import { createContactSchema, updateContactSchema } from "../schemas/contacts.schema";
import { authMiddleware } from "../middlewares/auth";

const router = Router();
router.post(
  "/",
  authMiddleware,
  validateSchema(createContactSchema),
  postContactController,
);
router.get("/", authMiddleware, getContactsController);
router.get("/:id", authMiddleware, getOneContactController);
router.delete("/:id", authMiddleware, deleteContactController);
router.patch(
  "/:id",
  authMiddleware,
  validateSchema(updateContactSchema),
  updateContactController,
);

export default router;
