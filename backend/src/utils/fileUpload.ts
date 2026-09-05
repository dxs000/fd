import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export const uploadImageToStorage = async (localPath: string): Promise<string> => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Уникальное имя, чтобы картинки не перетирали друг друга
  const ext = path.extname(localPath);
  const filename = `${crypto.randomUUID()}${ext}`;
  const destPath = path.join(UPLOAD_DIR, filename);

  await fs.rename(localPath, destPath);
  return `/uploads/${filename}`;
};

export const deleteImageFromStorage = async (publicUrl: string): Promise<void> => {
  if (!publicUrl || !publicUrl.startsWith("/uploads/")) return;

  const filename = path.basename(publicUrl); // защита от ../ в URL
  const filePath = path.join(UPLOAD_DIR, filename);

  // Ещё раз проверяем, что не вышли за пределы UPLOAD_DIR
  if (path.dirname(filePath) !== UPLOAD_DIR) return;

  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    // Файла уже нет — это ок; остальное логируем, но не роняем запрос
    if (err?.code !== "ENOENT") {
      console.error("Failed to delete old image:", err);
    }
  }
};