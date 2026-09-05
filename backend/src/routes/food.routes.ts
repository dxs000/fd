import { upload } from "./../middleware/multer.middleware";
import express from "express";
import { protect } from "../middleware/auth.middleware";
import { authorize } from "../middleware/authorize.middleware";
import {
  createFood,
  deleteFood,
  getAllFoods,
  getCategoryFoods,
  getRestaurantFoods,
  getSingleFood,
  updateFood,
} from "../controllers/food.controller";

const router = express.Router();

router.post(
  "/create",
  protect,
  authorize("RESTAURANT_OWNER"),
  upload.single("image"),
  createFood
);
router.patch(
  "/update/:id",
  protect,
  authorize("RESTAURANT_OWNER"),
  upload.single("image"),
  updateFood
);
router.delete("/delete/:id", protect, authorize("RESTAURANT_OWNER"), deleteFood);
router.get("/all", getAllFoods);
router.get("/restaurant/:restaurantId", getRestaurantFoods);
router.get("/category/:categoryId", getCategoryFoods);
router.get("/:id", getSingleFood);

export default router;
