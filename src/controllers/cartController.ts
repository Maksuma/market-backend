import { db } from "@/db"
import { cart, cartItem } from "@/db/models"
import { type AuthRequest } from "@/middleware/auth"
import { and, eq, isNull } from "drizzle-orm"
import type { NextFunction, Response } from "express"

async function getCartWithItems(userId: string) {
  return db.query.cart.findFirst({
    where: eq(cart.userId, userId),
    with: {
      items: {
        orderBy: (item, { asc }) => [asc(item.id)],
        with: { product: true },
      },
    },
  })
}

export async function getCart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id

    const userCart = await getCartWithItems(userId)

    if (!userCart) {
      return res.status(200).json({ items: [] })
    }

    res.status(200).json(userCart)
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function addItemToCart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const { productId, quantity = 1, color, size } = req.body

    if (!productId || typeof productId !== "number") {
      return res.status(400).json({ error: "Bad Request", message: "productId обязателен" })
    }
    if (typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ error: "Bad Request", message: "quantity должен быть положительным числом" })
    }

    let userCart = await db.query.cart.findFirst({ where: eq(cart.userId, userId) })

    if (!userCart) {
      const [newCart] = await db.insert(cart).values({ id: crypto.randomUUID(), userId }).returning()
      if (!newCart) throw new Error("Не удалось создать корзину")
      userCart = newCart
    }

    const existingItem = await db.query.cartItem.findFirst({
      where: and(
        eq(cartItem.cartId, userCart.id),
        eq(cartItem.productId, productId),
        color ? eq(cartItem.color, color) : isNull(cartItem.color),
        size ? eq(cartItem.size, size) : isNull(cartItem.size),
      ),
    })

    if (existingItem) {
      await db
        .update(cartItem)
        .set({ quantity: existingItem.quantity + quantity })
        .where(eq(cartItem.id, existingItem.id))
    } else {
      await db.insert(cartItem).values({
        cartId: userCart.id,
        productId,
        quantity,
        color: color ?? null,
        size: size ?? null,
      })
    }

    const updatedCart = await getCartWithItems(userId)
    res.status(200).json(updatedCart)
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function updateCartItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const itemId = Number(req.params.itemId)
    const { quantity } = req.body

    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Bad Request", message: "Некорректный ID элемента" })
    }
    if (typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ error: "Bad Request", message: "quantity должен быть положительным числом" })
    }

    const userCart = await db.query.cart.findFirst({ where: eq(cart.userId, userId) })
    if (!userCart) {
      return res.status(404).json({ error: "Not Found", message: "Корзина не найдена" })
    }

    const item = await db.query.cartItem.findFirst({
      where: and(eq(cartItem.id, itemId), eq(cartItem.cartId, userCart.id)),
    })
    if (!item) {
      return res.status(404).json({ error: "Not Found", message: "Элемент корзины не найден" })
    }

    await db.update(cartItem).set({ quantity }).where(eq(cartItem.id, itemId))

    const updatedCart = await getCartWithItems(userId)
    res.status(200).json(updatedCart)
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function removeCartItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const itemId = Number(req.params.itemId)

    if (isNaN(itemId)) {
      return res.status(400).json({ error: "Bad Request", message: "Некорректный ID элемента" })
    }

    const userCart = await db.query.cart.findFirst({ where: eq(cart.userId, userId) })
    if (!userCart) {
      return res.status(404).json({ error: "Not Found", message: "Корзина не найдена" })
    }

    const item = await db.query.cartItem.findFirst({
      where: and(eq(cartItem.id, itemId), eq(cartItem.cartId, userCart.id)),
    })
    if (!item) {
      return res.status(404).json({ error: "Not Found", message: "Элемент корзины не найден" })
    }

    await db.delete(cartItem).where(eq(cartItem.id, itemId))

    const updatedCart = await getCartWithItems(userId)
    res.status(200).json(updatedCart)
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function clearCart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id

    const userCart = await db.query.cart.findFirst({ where: eq(cart.userId, userId) })
    if (!userCart) {
      return res.status(404).json({ error: "Not Found", message: "Корзина не найдена" })
    }

    await db.delete(cartItem).where(eq(cartItem.cartId, userCart.id))

    res.status(200).json({ message: "Корзина очищена" })
  } catch (error) {
    res.status(500)
    next(error)
  }
}
