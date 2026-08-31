import express from "express"
import { protect } from "../middleware/auth.middleware";
import { authorize } from "../middleware/authorize.middleware";
import { createRestaurant, deleteRestaurant, getAllRestaurants, getSingleRestaurant, updateRestaurant } from "../controllers/restaurant.controller";

const router = express.Router();

router.post("/create",protect,authorize("RESTAURANT_OWNER"),createRestaurant);
router.get("/all",getAllRestaurants);
router.get("/:slug",getSingleRestaurant);
router.patch("/update/:id", protect, authorize("RESTAURANT_OWNER"), updateRestaurant);
router.delete("/delete/:id", protect, authorize("RESTAURANT_OWNER"), deleteRestaurant );

export default router;