import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import type { Request, Response } from "express";

function getAuthUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

function getParam(req: Request, key: string): string | undefined {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseQuantity(value: unknown, fallback = 1): number {
  const quantity = Number(value ?? fallback);
  if (!Number.isInteger(quantity) || quantity < 1) return NaN;
  return quantity;
}

const cartInclude = {
  items: {
    include: {
      good: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          price: true,
          isAvailable: true,
          restaurantId: true,
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
};

function summarizeCart(cart: {
  items: { quantity: number; good: { price: number } }[];
}) {
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.items.reduce((sum, item) => sum + item.quantity * item.good.price, 0);
  return { itemCount, total };
}

async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: cartInclude,
  });
}

export const getCart = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const cart = await getOrCreateCart(userId);
    const summary = summarizeCart(cart);

    return res.status(200).json({
      success: true,
      cart,
      ...summary,
    });
  } catch (error: unknown) {
    logger.error(error, "getCart error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const foodId =
      typeof req.body.foodId === "string"
        ? req.body.foodId
        : typeof req.body.goodId === "string"
          ? req.body.goodId
          : undefined;
    const quantity = parseQuantity(req.body.quantity, 1);

    if (!foodId) {
      return res.status(400).json({
        success: false,
        message: "foodId is required",
      });
    }

    if (Number.isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    const food = await prisma.food.findUnique({
      where: { id: foodId },
      select: {
        id: true,
        isAvailable: true,
        restaurantId: true,
      },
    });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food not found",
      });
    }

    if (!food.isAvailable) {
      return res.status(400).json({
        success: false,
        message: "Food is not available",
      });
    }

    const cart = await getOrCreateCart(userId);

    const otherRestaurantItem = cart.items.find(
      (item) => item.good.restaurantId !== food.restaurantId
    );
    if (otherRestaurantItem) {
      return res.status(409).json({
        success: false,
        message: "Cart already contains items from another restaurant",
      });
    }

    const existing = cart.items.find((item) => item.goodId === food.id);

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          goodId: food.id,
          quantity,
        },
      });
    }

    const updatedCart = await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Item added to cart",
      cart: updatedCart,
      ...summarizeCart(updatedCart),
    });
  } catch (error: unknown) {
    logger.error(error, "addToCart error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const itemId = getParam(req, "itemId") ?? getParam(req, "id");
    const quantity = parseQuantity(req.body.quantity);

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item id is required",
      });
    }

    if (Number.isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    const cart = await getOrCreateCart(userId);
    const item = cart.items.find((entry) => entry.id === itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    const updatedCart = await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Cart item updated",
      cart: updatedCart,
      ...summarizeCart(updatedCart),
    });
  } catch (error: unknown) {
    logger.error(error, "updateCartItem error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const itemId = getParam(req, "itemId") ?? getParam(req, "id");
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item id is required",
      });
    }

    const cart = await getOrCreateCart(userId);
    const item = cart.items.find((entry) => entry.id === itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    await prisma.cartItem.delete({ where: { id: item.id } });

    const updatedCart = await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
      cart: updatedCart,
      ...summarizeCart(updatedCart),
    });
  } catch (error: unknown) {
    logger.error(error, "removeFromCart error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const clearCart = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const cart = await getOrCreateCart(userId);

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    const updatedCart = await prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Cart cleared",
      cart: updatedCart,
      ...summarizeCart(updatedCart),
    });
  } catch (error: unknown) {
    logger.error(error, "clearCart error");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
