import multer from "multer";
import path from "path";
import fs from "fs";
import { ResponseError } from "../entities/responseError";

const ensureUploadsFolderExists = () => {
  const uploadsFolder = "uploads/";
  if (!fs.existsSync(uploadsFolder)) {
    fs.mkdirSync(uploadsFolder, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsFolderExists();
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith("image/") && file.mimetype !== "image/gif") {
    cb(null, true);
  } else {
    cb(new ResponseError(422, "Only image files are allowed!"), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 200 * 1024 },
});
