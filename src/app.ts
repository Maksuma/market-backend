import { auth } from "@/utils/auth"
import { toNodeHandler } from "better-auth/node"
import cors from "cors"
import express from "express"
import { handleWebhook } from "./controllers/checkoutController.ts"
import { errorHandler } from "./middleware/errorHandler.ts"
import cartRoutes from "./routes/cartRoutes.ts"
import categoriesRoutes from "./routes/categoriesRoutes.ts"
import checkoutRoutes from "./routes/checkoutRoutes.ts"
import productsRoutes from "./routes/productsRoutes.ts"
import uploadsRoutes from "./routes/uploadsRoutes.ts"

const app = express()

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || /^http:\/\/localhost:4000/.test(origin) || /^http:\/\/localhost:3005/.test(origin)) {
        callback(null, origin)
      } else {
        callback(null, "http://localhost:4000")
      }
    },
    credentials: true,
  }),
)

app.all("/api/auth/{*any}", toNodeHandler(auth))

// Webhook must use raw body — register BEFORE express.json()
app.post("/api/checkout/webhook", express.raw({ type: "application/json" }), handleWebhook)

app.use(express.json())

app.use("/api/products", productsRoutes)
app.use("/api/categories", categoriesRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/checkout", checkoutRoutes)
app.use("/api/upload", uploadsRoutes)
app.use("/api/uploads", express.static("uploads"))
app.use(errorHandler)

export default app
