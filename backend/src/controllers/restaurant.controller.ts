import { prisma } from "../lib/prisma";
import slugify from "slugify";
import { logger } from "../lib/logger";
import type { Request, Response } from "express";


type AuthRequest = Request & { user: { id: string } };

function makeSlug(name: string) {
  return slugify(name, { lower: true, strict: true, trim: true });
}

function getAuthUserId(req: Request): string | null {
  const id = (req as AuthRequest).user?.id;
  return id ?? null;
}

export const createRestaurant = async (req: Request, res: Response) => {
  try {
    const ownerId = getAuthUserId(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { name, description, phone, email, address, city, openingTime, closingTime } = req.body;

    if (!name || !address || !city) {
      return res.status(400).json({
        success: false,
        message: "Name, address and city are required",
      });
    }

    const slug = makeSlug(name);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Name must contain letters or numbers",
      });
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        slug,
        description,
        phone,
        email,
        address,
        city,
        openingTime,
        closingTime,
        ownerId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      restaurant,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Restaurant already exists",
      });
    }

    logger.error(error, "create restaurant error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAllRestaurants = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const city = typeof req.query.city === "string" ? req.query.city : undefined;

    const where = city ? { city } : {};

    const [restaurants, count] = await prisma.$transaction([
      prisma.restaurant.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.restaurant.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      count,
      page,
      limit,
      restaurants,
    });
  } catch (error: unknown) {
    logger.error(error, "get all restaurants error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSingleRestaurant = async (req: Request, res: Response) => {
  try {
    const slugParam = req.params.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Slug is required",
      });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    return res.status(200).json({
      success: true,
      restaurant,
    });
  } catch (error: unknown) {
    logger.error(error, "get single restaurant error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateRestaurant = async (req: Request, res: Response) => {
  try {

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
    return res.status(400).json({
        success: false,
        message: "Id is required",
        });
    }
    const ownerId = getAuthUserId(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    
    const { name, description, phone, email, address, city, openingTime, closingTime, isOpen } =
      req.body;

    const restaurant = await prisma.restaurant.findUnique({ where: { id } });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (restaurant.ownerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this restaurant",
      });
    }

    let nextSlug = restaurant.slug;
    if (typeof name === "string" && name !== restaurant.name) {
      nextSlug = makeSlug(name);
      if (!nextSlug) {
        return res.status(400).json({
          success: false,
          message: "Name must contain letters or numbers",
        });
      }
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: name ?? restaurant.name,
        slug: nextSlug,
        description,
        phone,
        email,
        address,
        city,
        openingTime,
        closingTime,
        ...(typeof isOpen === "boolean" ? { isOpen } : {}),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Restaurant updated successfully",
      restaurant: updatedRestaurant,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Restaurant with this name already exists",
      });
    }

    logger.error(error, "update restaurant error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteRestaurant = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
    return res.status(400).json({
        success: false,
        message: "Id is required",
    });
    }

    const ownerId = getAuthUserId(req);
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (restaurant.ownerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this restaurant",
      });
    }

    await prisma.restaurant.delete({ where: { id: restaurant.id } });

    return res.status(200).json({
      success: true,
      message: "Restaurant deleted successfully",
    });
  } catch (error: unknown) {
    logger.error(error, "delete restaurant error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};