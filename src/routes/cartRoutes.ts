import { addItemToCart, clearCart, getCart, removeCartItem, updateCartItem } from "@/controllers/cartController"
import { protectedRoute } from "@/middleware/auth"
import { Router } from "express"

const router = Router()

router.use(protectedRoute)

router.get("/", getCart)
router.post("/items", addItemToCart)
router.patch("/items/:itemId", updateCartItem)
router.delete("/items/:itemId", removeCartItem)
router.delete("/", clearCart)

export default router
