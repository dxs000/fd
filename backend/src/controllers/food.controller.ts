import { prisma } from "../lib/prisma";
import slugify from "slugify";
import { logger } from "../lib/logger";
import type { Request, Response } from "express";
import { uploadImageToStorage, deleteImageFromStorage } from "../utils/fileUpload";

type AuthRequest = Request & { user?: { id: string } };

function makeSlug(name: string) {
  return slugify(name, { lower: true, strict: true, trim: true });
}

function getAuthUserId(req: Request): string | null {
  return (req as AuthRequest).user?.id ?? null;
}

function getParam(req: Request, key: string): string | undefined {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parsePrice(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) return NaN;
  return price;
}

function parseIsAvailable(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export const createFood = async (req: Request, res: Response) => {
  try {
    const { name, description, price, categoryId, restaurantId, isAvailable } = req.body as {
      name?: string;
      description?: string;
      price?: unknown;
      categoryId?: string;
      restaurantId?: string;
      isAvailable?: unknown;
    };

    if (!name?.trim() || !categoryId || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: "Name, categoryId and restaurantId are required.",
      });
    }

    const parsedPrice = parsePrice(price);
    if (parsedPrice === null || Number.isNaN(parsedPrice)) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required",
      });
    }

    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, ownerId: true },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant is not found",
      });
    }

    if (restaurant.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to add food to this restaurant",
      });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, restaurantId: true },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category is not found",
      });
    }

    if (category.restaurantId !== restaurantId) {
      return res.status(400).json({
        success: false,
        message: "Category does not belong to this restaurant",
      });
    }

    const slug = makeSlug(name.trim());
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Name produces an empty slug",
      });
    }

    let imageUrl: string | null = null;
    if (req.file?.path) {
      imageUrl = await uploadImageToStorage(req.file.path);
    }

    const available = parseIsAvailable(isAvailable);

    const food = await prisma.food.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        price: parsedPrice,
        isAvailable: available ?? true,
        restaurantId,
        categoryId,
        image: imageUrl,
      },
    });

    return res.status(201).json({
      success: true,
      data: food,
      message: "Food created successfully",
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Food with this name already exists in this restaurant",
      });
    }

    logger.error(error, "createFood error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllFoods = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const restaurantId =
      typeof req.query.restaurantId === "string" ? req.query.restaurantId : undefined;
    const categoryId =
      typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;

    const where: { restaurantId?: string; categoryId?: string } = {};
    if (restaurantId) where.restaurantId = restaurantId;
    if (categoryId) where.categoryId = categoryId;

    const [foods, count] = await prisma.$transaction([
      prisma.food.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              isOpen: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.food.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      count,
      page,
      limit,
      foods,
    });
  } catch (error: unknown) {
    logger.error(error, "getAllFoods error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getRestaurantFoods = async (req: Request, res: Response) => {
  try {
    const restaurantId = getParam(req, "restaurantId");

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: "restaurantId is required",
      });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant is not found",
      });
    }

    const foods = await prisma.food.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: foods.length,
      foods,
    });
  } catch (error: unknown) {
    logger.error(error, "getRestaurantFoods error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getCategoryFoods = async (req: Request, res: Response) => {
  try {
    const categoryId = getParam(req, "categoryId");

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "categoryId is required",
      });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category is not found",
      });
    }

    const foods = await prisma.food.findMany({
      where: { categoryId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: foods.length,
      foods,
    });
  } catch (error: unknown) {
    logger.error(error, "getCategoryFoods error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getSingleFood = async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Id is required",
      });
    }

    const food = await prisma.food.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            isOpen: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found",
      });
    }

    return res.status(200).json({
      success: true,
      food,
    });
  } catch (error: unknown) {
    logger.error(error, "getSingleFood error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateFood = async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    const { name, description, price, isAvailable, categoryId } = req.body as {
      name?: string;
      description?: string;
      price?: unknown;
      isAvailable?: unknown;
      categoryId?: string;
    };

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Id is required",
      });
    }

    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const food = await prisma.food.findUnique({
      where: { id },
      include: {
        restaurant: { select: { ownerId: true, id: true } },
      },
    });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found",
      });
    }

    if (food.restaurant.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this food",
      });
    }

    let nextSlug = food.slug;
    let nextName = food.name;

    if (typeof name === "string" && name.trim() && name.trim() !== food.name) {
      nextName = name.trim();
      nextSlug = makeSlug(nextName);
      if (!nextSlug) {
        return res.status(400).json({
          success: false,
          message: "Name produces an empty slug",
        });
      }
    }

    let nextCategoryId = food.categoryId;
    if (typeof categoryId === "string" && categoryId && categoryId !== food.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, restaurantId: true },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category is not found",
        });
      }

      if (category.restaurantId !== food.restaurant.id) {
        return res.status(400).json({
          success: false,
          message: "Category does not belong to this restaurant",
        });
      }

      nextCategoryId = category.id;
    }

    let nextPrice = food.price;
    if (price !== undefined) {
      const parsedPrice = parsePrice(price);
      if (parsedPrice === null || Number.isNaN(parsedPrice)) {
        return res.status(400).json({
          success: false,
          message: "Valid price is required",
        });
      }
      nextPrice = parsedPrice;
    }

    const nextAvailable = parseIsAvailable(isAvailable);

    let nextImage = food.image;
    if (req.file?.path) {
      const uploaded = await uploadImageToStorage(req.file.path);
      if (food.image) {
        await deleteImageFromStorage(food.image);
      }
      nextImage = uploaded;
    }

    const updatedFood = await prisma.food.update({
      where: { id: food.id },
      data: {
        name: nextName,
        slug: nextSlug,
        description: description !== undefined ? description?.trim() || null : food.description,
        price: nextPrice,
        isAvailable: nextAvailable ?? food.isAvailable,
        categoryId: nextCategoryId,
        image: nextImage,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Food updated successfully",
      food: updatedFood,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Food with this name already exists in this restaurant",
      });
    }

    logger.error(error, "updateFood error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteFood = async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Id is required",
      });
    }

    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const food = await prisma.food.findUnique({
      where: { id },
      include: {
        restaurant: { select: { ownerId: true } },
      },
    });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found",
      });
    }

    if (food.restaurant.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this food",
      });
    }

    await prisma.food.delete({ where: { id: food.id } });

    if (food.image) {
      await deleteImageFromStorage(food.image);
    }

    return res.status(200).json({
      success: true,
      message: "Food deleted successfully",
    });
  } catch (error: unknown) {
    logger.error(error, "deleteFood error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
