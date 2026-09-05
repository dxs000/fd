import { upload } from './../middleware/multer.middleware';
import express from "express"
import { protect } from "../middleware/auth.middleware";
import { authorize } from "../middleware/authorize.middleware";
import { createCategory, deleteCategory, getAllCategories, getRestaurantCategories, updateCategory } from '../controllers/category.controller';

const router = express.Router();
router.post("/create",protect,authorize("RESTAURANT_OWNER"),upload.single("image"),createCategory);
router.patch("/update/:id",protect,authorize("RESTAURANT_OWNER"),upload.single("image"),updateCategory);
router.delete("/delete/:id",protect,authorize("RESTAURANT_OWNER"),deleteCategory )
router.get("/all",getAllCategories);
router.get("/restaurant/:restaurantId", getRestaurantCategories);

export default router;