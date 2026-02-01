import { db } from "@/db"
import { review } from "@/db/models"
import { eq } from "drizzle-orm"
import type { NextFunction, Request, Response } from "express"

export async function sendReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, rating, comment, userId } = req.body

    const newReview = await db.insert(review).values({
      productId,
      rating,
      comment,
      userId,
    })
    return res.status(201).json(newReview)
  } catch (error) {
    console.error("SendReview controller error:", error)
    res.status(500)
    next(error)
  }
}

export async function getReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = Number(req.params.id)
    const reviews = await db.query.review.findMany({
      where: eq(review.productId, productId),
    })

    return res.status(200).json(reviews)
  } catch (error) {
    console.error("GetReviews controller error:", error)
    res.status(500)
    next(error)
  }
}

export async function deleteReview(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewId = Number(req.params.id)
    const deletedReview = await db.query.review.findFirst({
      where: eq(review.id, reviewId),
    })

    if (!deletedReview) {
      return res.status(404).json({
        error: "Not Found",
        message: "Отзыв не найден",
      })
    }

    await db.delete(review).where(eq(review.id, reviewId))

    return res.status(200).json({ message: "Отзыв успешно удален" })
  } catch (error) {
    console.error("DeleteReview controller error:", error)
    res.status(500)
    next(error)
  }
}
