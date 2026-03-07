import { db } from "@/db"
import { cart, cartItem, order, orderItem } from "@/db/models"
import { type AuthRequest } from "@/middleware/auth"
import { stripe } from "@/utils/stripe"
import { and, eq } from "drizzle-orm"
import type { NextFunction, Request, Response } from "express"
import type Stripe from "stripe"

export async function createCheckoutSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id

    const userCart = await db.query.cart.findFirst({
      where: eq(cart.userId, userId),
      with: {
        items: {
          orderBy: (item, { asc }) => [asc(item.id)],
          with: { product: true },
        },
      },
    })

    if (!userCart || userCart.items.length === 0) {
      return res.status(400).json({ error: "Bad Request", message: "Корзина пуста" })
    }

    const totalAmount = userCart.items.reduce((sum, item) => {
      const price = item.product.discountPrice ?? item.product.price
      return sum + price * item.quantity
    }, 0)

    const orderId = crypto.randomUUID()
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3005"
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:4000"

    await db.transaction(async tx => {
      await tx.insert(order).values({
        id: orderId,
        userId,
        status: "pending",
        totalAmount,
      })

      await tx.insert(orderItem).values(
        userCart.items.map(item => ({
          orderId,
          productId: item.productId,
          productName: item.product.name,
          productPrice: item.product.discountPrice ?? item.product.price,
          quantity: item.quantity,
          color: item.color ?? null,
          size: item.size ?? null,
        })),
      )
    })

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: userCart.items.map(item => ({
        price_data: {
          currency: "rub",
          unit_amount: (item.product.discountPrice ?? item.product.price) * 100,
          product_data: {
            name: item.product.name,
            ...(item.product.images[0] ? { images: [`${backendUrl}/api/uploads/${item.product.images[0]}`] } : {}),
          },
        },
        quantity: item.quantity,
      })),
      metadata: { orderId },
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/checkout/cancel`,
    })

    res.status(200).json({ url: session.url })
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  const sig = req.headers["stripe-signature"] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return res.status(500).json({ error: "Webhook secret not configured" })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret)
  } catch {
    return res.status(400).json({ error: "Webhook signature verification failed" })
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.orderId

      if (!orderId) return res.status(200).json({ received: true })

      const existingOrder = await db.query.order.findFirst({
        where: eq(order.id, orderId),
      })

      if (!existingOrder || existingOrder.status !== "pending") {
        return res.status(200).json({ received: true })
      }

      await db
        .update(order)
        .set({
          status: "paid",
          stripeSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .where(eq(order.id, orderId))

      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, existingOrder.userId),
      })
      if (userCart) {
        await db.delete(cartItem).where(eq(cartItem.cartId, userCart.id))
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.orderId

      if (!orderId) return res.status(200).json({ received: true })

      await db
        .update(order)
        .set({ status: "cancelled" })
        .where(and(eq(order.id, orderId), eq(order.status, "pending")))
    }

    res.status(200).json({ received: true })
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function getOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id

    const orders = await db.query.order.findMany({
      where: eq(order.userId, userId),
      with: {
        items: true,
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    })

    res.status(200).json(orders)
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function getOrderById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const { orderId } = req.params

    const foundOrder = await db.query.order.findFirst({
      where: and(eq(order.id, orderId as string), eq(order.userId, userId)),
      with: {
        items: true,
      },
    })

    if (!foundOrder) {
      return res.status(404).json({ error: "Not Found", message: "Заказ не найден" })
    }

    res.status(200).json(foundOrder)
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function verifySession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const { session_id } = req.query

    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({ error: "Bad Request", message: "session_id обязателен" })
    }

    const stripeSession = await stripe.checkout.sessions.retrieve(session_id)
    const orderId = stripeSession.metadata?.orderId

    if (!orderId) {
      return res.status(404).json({ error: "Not Found", message: "Заказ не найден" })
    }

    const existingOrder = await db.query.order.findFirst({
      where: and(eq(order.id, orderId), eq(order.userId, userId)),
    })

    if (!existingOrder) {
      return res.status(404).json({ error: "Not Found", message: "Заказ не найден" })
    }

    if (existingOrder.status === "paid") {
      return res.status(200).json({ status: "paid" })
    }

    if (stripeSession.payment_status === "paid" && existingOrder.status === "pending") {
      await db
        .update(order)
        .set({
          status: "paid",
          stripeSessionId: stripeSession.id,
          stripePaymentIntentId: typeof stripeSession.payment_intent === "string" ? stripeSession.payment_intent : null,
        })
        .where(eq(order.id, orderId))

      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
      })
      if (userCart) {
        await db.delete(cartItem).where(eq(cartItem.cartId, userCart.id))
      }

      return res.status(200).json({ status: "paid" })
    }

    res.status(200).json({ status: existingOrder.status })
  } catch (error) {
    res.status(500)
    next(error)
  }
}
