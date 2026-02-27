import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryBySlug,
  updateCategory,
} from "@/controllers/categoryController"
import { protectedRoute, requireAdmin } from "@/middleware/auth"
import { Router } from "express"

const router = Router()

router.get("/", getCategories)
router.get("/:slug", getCategoryBySlug)
router.post("/", protectedRoute, requireAdmin, createCategory)
router.put("/:id", protectedRoute, requireAdmin, updateCategory)
router.delete("/:id", protectedRoute, requireAdmin, deleteCategory)

export default router
