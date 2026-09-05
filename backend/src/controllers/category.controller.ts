import { prisma } from "../lib/prisma";
import slugify from "slugify";
import type { Request, Response } from "express";
import { uploadImageToStorage, deleteImageFromStorage } from "../utils/fileUpload";
import { success } from "zod";


type AuthRequest = Request & { user?: { id: string } };

function makeSlug(name: string) {
  return slugify(name, { lower: true, strict: true, trim: true });
}

function getAuthUserId(req: Request): string | null {
  return (req as AuthRequest).user?.id ?? null;
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

    const existingCategory = await prisma.category.findUnique({
      where: {
        slug_restaurantId: {
          slug,
          restaurantId,
        },
      },
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists in this restaurant",
      });
    }

    let imageUrl = null;

    if (req.file?.path) {
        imageUrl = await uploadImageToStorage(req.file.path);
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        restaurantId,
        image: imageUrl
      },
    });

    return res.status(201).json({
      success: true,
      data: category,
      message: "Category created sucessfully"
    });
  } catch (error) {
        console.error("createCategory error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getAllCategories = async(req:Request, res:Response) => {
    try{
        const categories = await prisma.category.findMany({
            orderBy: {
                createdAt: "desc"
            }, 
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name:true,
                        slug: true,
                        city: true,
                        isOpen: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            totalCategories: categories.length,
            categories
        });

    } catch(error) {
        console.error("createCategory error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export const getRestaurantCategories = async(req:Request, res:Response) => {
    try{
        const { restaurantId } = req.params;
        
        const categories = await prisma.category.findMany({
            where: {
                restaurantId
            },
            orderBy: {
                createdAt: "desc"
            }
        })
    } catch(error) {
        console.error("createCategory error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}