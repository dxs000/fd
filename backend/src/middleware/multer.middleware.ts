import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";


const TEMP_DIR = "./public/temp";

// создаём папку заранее, иначе multer упадёт на первой же загрузке
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    // уникальное имя, чтобы файлы с одинаковым originalname не перетирали друг друга
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

// пропускаем только изображения (у тебя же profileImage / картинки к постам)
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    // Error 
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 МБ
  },
});

