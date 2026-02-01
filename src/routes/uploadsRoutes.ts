import { storage, uploadImages } from "@/controllers/uploadController"
import { protectedRoute, requireAdmin } from "@/middleware/auth"
import { Router } from "express"
import multer from "multer"

const router = Router()

// Multer обрабатывает поле "images" - можно отправить одно изображение или массив
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB на файл
    files: 10, // максимум 10 файлов
  },
})

router.post("/", protectedRoute, requireAdmin, upload.array("file", 10), uploadImages)

export default router
