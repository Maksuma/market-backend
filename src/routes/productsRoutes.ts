import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "@/controllers/productController"
import { protectedRoute, requireAdmin } from "@/middleware/auth"
import { Router } from "express"

const router = Router()

router.get("/", getProducts)
router.get("/:id", getProductById)

router.post("/", protectedRoute, requireAdmin, createProduct)
router.put("/:id", protectedRoute, requireAdmin, updateProduct)
router.delete("/:id", protectedRoute, requireAdmin, deleteProduct)

export default router
