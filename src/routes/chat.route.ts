import { Router } from "express";
import {
  deleteConversationController,
  getConversationController,
  getConversationsController,
  sendChatController,
} from "../controllers/chat.controller";
import { authMiddleware } from "../middlewares/auth";
import { validateSchema } from "../middlewares/schema";
import { chatSchema } from "../schemas/chat.schema";

const router = Router();
router.post(
  "/",
  authMiddleware,
  validateSchema(chatSchema),
  sendChatController,
);
router.get("/conversations", authMiddleware, getConversationsController);
router.get("/conversations/:id", authMiddleware, getConversationController);
router.delete(
  "/conversations/:id",
  authMiddleware,
  deleteConversationController,
);

export default router;
