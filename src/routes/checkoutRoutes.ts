import { createCheckoutSession, getOrderById, getOrders, verifySession } from "@/controllers/checkoutController"
import { protectedRoute } from "@/middleware/auth"
import { Router } from "express"

const router = Router()

router.use(protectedRoute)

router.post("/create-session", createCheckoutSession)
router.get("/verify-session", verifySession)
router.get("/orders", getOrders)
router.get("/orders/:orderId", getOrderById)

export default router
