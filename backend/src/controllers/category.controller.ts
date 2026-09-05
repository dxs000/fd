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

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, restaurantId } = req.body as {
      name?: string;
      restaurantId?: string;
    };

    if (!name?.trim() || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: "Name and restaurantId are required.",
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
        message: "You are not authorized to add categories to this restaurant",
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

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        restaurantId,
        image: imageUrl,
      },
    });

    return res.status(201).json({
      success: true,
      data: category,
      message: "Category created successfully",
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists in this restaurant",
      });
    }

    logger.error(error, "createCategory error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const restaurantId =
      typeof req.query.restaurantId === "string" ? req.query.restaurantId : undefined;

    const where = restaurantId ? { restaurantId } : {};

    const [categories, count] = await prisma.$transaction([
      prisma.category.findMany({
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
        },
      }),
      prisma.category.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      count,
      page,
      limit,
      categories,
    });
  } catch (error: unknown) {
    logger.error(error, "getAllCategories error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getRestaurantCategories = async (req: Request, res: Response) => {
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

    const categories = await prisma.category.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error: unknown) {
    logger.error(error, "getRestaurantCategories error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getSingleCategory = async (req: Request, res: Response) => {
  try {
    const id = getParam(req, "id");

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Id is required",
      });
    }

    const category = await prisma.category.findUnique({
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
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error: unknown) {
    logger.error(error, "getSingleCategory error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
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

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        restaurant: { select: { ownerId: true } },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (category.restaurant.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this category",
      });
    }

    const { name } = req.body as { name?: string };

    let nextSlug = category.slug;
    let nextName = category.name;

    if (typeof name === "string" && name.trim() && name.trim() !== category.name) {
      nextName = name.trim();
      nextSlug = makeSlug(nextName);
      if (!nextSlug) {
        return res.status(400).json({
          success: false,
          message: "Name produces an empty slug",
        });
      }
    }

    let nextImage = category.image;
    if (req.file?.path) {
      const uploaded = await uploadImageToStorage(req.file.path);
      if (category.image) {
        await deleteImageFromStorage(category.image);
      }
      nextImage = uploaded;
    }

    const updatedCategory = await prisma.category.update({
      where: { id: category.id },
      data: {
        name: nextName,
        slug: nextSlug,
        image: nextImage,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists in this restaurant",
      });
    }

    logger.error(error, "updateCategory error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
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

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        restaurant: { select: { ownerId: true } },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (category.restaurant.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this category",
      });
    }

    await prisma.category.delete({ where: { id: category.id } });

    if (category.image) {
      await deleteImageFromStorage(category.image);
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error: unknown) {
    logger.error(error, "deleteCategory error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
