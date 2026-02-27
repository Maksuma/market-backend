import { db } from "@/db"
import { product, type TProduct } from "@/db/models"
import { deleteFolder, deleteImagesFromFolder } from "@/utils/delete-images-from-folder"
import { moveImagesFromTemp } from "@/utils/move-image-from-temp"
import { renameFolderWithImages } from "@/utils/rename-folder-with-images"
import { slugGenerator } from "@/utils/slug-generator"
import { eq } from "drizzle-orm"
import type { NextFunction, Request, Response } from "express"
import path from "path"

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { popular, categoryId } = req.query

    if (categoryId) {
      const id = Number(categoryId)
      if (isNaN(id)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Некорректный ID категории",
        })
      }
      const productsByCategory = await db.query.product.findMany({
        where: eq(product.categoryId, id),
      })
      return res.status(200).json(productsByCategory)
    }

    if (popular === "true") {
      const popularProducts = await db.query.product.findMany({
        where: eq(product.isPopular, true),
      })
      return res.status(200).json(popularProducts)
    }

    const products = await db.query.product.findMany()
    res.status(200).json(products)
  } catch (error) {
    console.error("Ошибка при получении продуктов:", error)
    res.status(500)
    next(error)
  }
}

export async function getProductBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.productName as string

    if (!slug || slug.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Некорректный имя продукта",
      })
    }

    const productBySlug = await db.query.product.findFirst({
      where: eq(product.linkName, slug),
    })

    if (!productBySlug) {
      return res.status(404).json({
        error: "Not Found",
        message: "Продукт не найден",
      })
    }
    return res.status(200).json(productBySlug)
  } catch (error) {
    console.error("Ошибка при получении продукта по ID:", error)
    res.status(500)
    next(error)
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body
    const linkName = slugGenerator(data.name)
    const discountPrice = data.discountPrice === "" ? null : data.discountPrice

    let images = data.images || []
    if (images.length > 0 && images.some((url: string) => url.includes("/temp-product/"))) {
      try {
        images = await moveImagesFromTemp(data.name, images, "products")
      } catch (error) {
        console.error("Ошибка при перемещении изображений:", error)
      }
    }
    const newProduct = await db
      .insert(product)
      .values({
        ...data,
        linkName,
        discountPrice,
        images,
      })
      .returning()
    res.status(201).json(newProduct[0])
  } catch (error) {
    console.error("Ошибка при создании продукта:", error)
    res.status(500)
    next(error)
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    const {
      name,
      description,
      price,
      discountPrice,
      atStock,
      categoryId,
      isPopular,
      images,
      specifications,
      colors,
      hasColors,
      hasSizes,
      rating,
      reviewsCount,
      sizes,
    } = req.body
    if (isNaN(id)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Некорректный ID продукта",
      })
    }
    if (!name || price === undefined || price < 0 || atStock === undefined || !categoryId) {
      return res.status(400).json({ error: "Отсутствуют обязательные поля или неверные значения" })
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Необходимо добавить хотя бы одно изображение" })
    }

    if (discountPrice !== null && discountPrice !== undefined && discountPrice < 0) {
      return res.status(400).json({ error: "Цена не может быть отрицательной" })
    }
    const linkName = slugGenerator(name)

    const existingProduct = await db.query.product.findFirst({
      where: eq(product.id, id),
    })

    if (!existingProduct) {
      return res.status(404).json({
        error: "Not Found",
        message: "Продукт не найден",
      })
    }

    const nameChanged = existingProduct.name !== name

    const newImagesFromTemp = images.filter((img: string) => img.includes("/temp-product/"))
    const existingImages = images.filter((img: string) => !img.includes("/temp-product/"))

    const deletedImages = existingProduct.images.filter(
      (img: string) => !existingImages.some((newImg: string) => newImg === img),
    )

    const currentSlugMatch = existingProduct.images[0]?.match(/\/api\/uploads\/products\/([^/]+)\//)
    const currentSlugInPath = currentSlugMatch?.[1]
    const newSlug = slugGenerator(name)

    let finalImages: string[] = []

    if (deletedImages.length > 0 && currentSlugInPath && currentSlugInPath !== "temp-product") {
      const folderPath = path.join(process.cwd(), "uploads", "products", currentSlugInPath)
      await deleteImagesFromFolder(folderPath, deletedImages)
    }

    if (newImagesFromTemp.length > 0) {
      const targetName = nameChanged ? name : existingProduct.name
      const movedImages = await moveImagesFromTemp(targetName, newImagesFromTemp, "products")

      if (nameChanged && existingImages.length > 0 && currentSlugInPath && currentSlugInPath !== newSlug) {
        const renamedImages = await renameFolderWithImages(name, "products", id)
        finalImages = [...renamedImages, ...movedImages]
      } else {
        finalImages = [...existingImages, ...movedImages]
      }
    } else if (nameChanged && currentSlugInPath && currentSlugInPath !== newSlug) {
      const renamedImages = await renameFolderWithImages(name, "products", id)
      finalImages = renamedImages.length > 0 ? renamedImages : existingImages
    } else {
      finalImages = existingImages
    }

    const orderedFinalImages = images.map((originalImg: string) => {
      if (originalImg.includes("/temp-product/")) {
        const filename = originalImg.split("/").pop()
        return finalImages.find(img => img.endsWith(filename!)) || originalImg
      }
      const filename = originalImg.split("/").pop()
      return finalImages.find(img => img.endsWith(filename!)) || originalImg
    })

    const updatedFields: TProduct = {
      id,
      name,
      linkName,
      description,
      price,
      discountPrice,
      atStock,
      categoryId,
      isPopular,
      images: orderedFinalImages,
      specifications,
      colors,
      hasColors,
      hasSizes,
      rating,
      reviewsCount,
      sizes,
    }
    const patchedProduct = await db.update(product).set(updatedFields).where(eq(product.id, id)).returning()
    return res.status(200).json(patchedProduct[0])
  } catch (error) {
    res.status(500)
    next(error)
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Некорректный ID продукта",
      })
    }

    const deletedProduct = await db.delete(product).where(eq(product.id, id)).returning()

    if (deletedProduct.length === 0 || !deletedProduct[0]) {
      return res.status(404).json({
        error: "Not Found",
        message: "Продукт не найден",
      })
    }

    const folderPath = path.join(process.cwd(), "uploads", "products", slugGenerator(deletedProduct[0].name))
    await deleteFolder(folderPath)

    return res.status(200).json({ message: "Продукт успешно удален" })
  } catch (error) {
    console.error("Ошибка при удалении продукта:", error)
    res.status(500)
    next(error)
  }
}
