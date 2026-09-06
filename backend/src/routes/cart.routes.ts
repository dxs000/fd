import express from "express";
import { protect } from "../middleware/auth.middleware";
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartItem,
} from "../controllers/cart.controller";

const router = express.Router();

router.use(protect);

router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", removeFromCart);
router.delete("/", clearCart);

export default router;
