import { db } from "@/db"
import { category } from "@/db/models"
import { deleteFolder } from "@/utils/delete-images-from-folder"
import { moveImagesFromTemp } from "@/utils/move-image-from-temp"
import { renameFolderWithImages } from "@/utils/rename-folder-with-images"
import { slugGenerator } from "@/utils/slug-generator"
import { eq } from "drizzle-orm"
import type { NextFunction, Request, Response } from "express"
import path from "path"

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await db.query.category.findMany()
    return res.status(200).json(categories)
  } catch (error) {
    console.error("Ошибка при получении категорий:", error)
    res.status(500)
    next(error)
  }
}

export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params
    if (!slug || typeof slug !== "string") {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "Неверный slug категории",
      })
    }

    const categoryData = await db.query.category.findFirst({
      where: eq(category.linkName, slug),
      with: {
        products: true,
      },
    })

    if (!categoryData) {
      return res.status(404).json({
        error: "Not Found",
        message: "Категория не найдена",
      })
    }

    return res.status(200).json(categoryData)
  } catch (error) {
    console.error("Ошибка при получении категории по slug:", error)
    res.status(500)
    next(error)
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, specifications, images } = req.body

    if (
      !name ||
      typeof name !== "string" ||
      !images ||
      !Array.isArray(images) ||
      images.length === 0 ||
      typeof images[0] !== "string"
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Неверные данные",
      })
    }
    const linkName = slugGenerator(name)

    let image = images[0] || "" || undefined
    if (images.length > 0 && images.some((url: string) => url.includes("/temp-product/"))) {
      try {
        image = (await moveImagesFromTemp(name, images, "categories"))[0]
      } catch (error) {
        console.error("Ошибка при перемещении изображений:", error)
        res.status(500)
        next(error)
        return
      }
    }

    if (!image) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Изображение категории обязательно",
      })
    }

    const newCategory = await db
      .insert(category)
      .values({
        name,
        linkName,
        image,
        specifications,
      })
      .returning()
    return res.status(201).json(newCategory[0])
  } catch (error) {
    console.error("Ошибка при создании категории:", error)
    res.status(500)
    next(error)
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Неверный ID категории",
      })
    }

    const { name, specifications, images } = req.body

    if (
      !name ||
      typeof name !== "string" ||
      !Array.isArray(images) ||
      images.length === 0 ||
      typeof images[0] !== "string"
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Неверные данные",
      })
    }

    const linkName = slugGenerator(name)

    const existingCategory = await db.query.category.findFirst({
      where: eq(category.id, id),
    })

    if (!existingCategory) {
      return res.status(404).json({
        error: "Not Found",
        message: "Категория не найдена",
      })
    }

    const nameChanged = existingCategory.name !== name
    const isNewImageFromTemp = images[0].includes("/temp-product/")

    let finalImage = existingCategory.image

    // Извлекаем текущий slug из пути изображения в БД
    const currentSlugMatch = existingCategory.image.match(/\/api\/uploads\/categories\/([^/]+)\//)
    const currentSlugInPath = currentSlugMatch?.[1]
    const newSlug = slugGenerator(name)

    if (isNewImageFromTemp) {
      // Новое изображение из temp — удаляем старую папку и перемещаем новое изображение
      if (currentSlugInPath && currentSlugInPath !== "temp-product") {
        const oldFolderPath = path.join(process.cwd(), "uploads", "categories", currentSlugInPath)
        await deleteFolder(oldFolderPath)
      }

      // Перемещаем новое изображение в папку с новым именем
      const movedImages = await moveImagesFromTemp(name, images, "categories")
      finalImage = movedImages[0] || images[0]
    } else if (nameChanged && currentSlugInPath && currentSlugInPath !== newSlug) {
      // Имя изменилось, изображение то же — переименовываем папку
      const renamedImages = await renameFolderWithImages(name, "categories", id)
      if (renamedImages.length > 0) {
        finalImage = renamedImages[0]!
      }
    }

    const updatedCategory = await db
      .update(category)
      .set({
        name,
        linkName,
        image: finalImage,
        specifications,
      })
      .where(eq(category.id, id))
      .returning()

    if (updatedCategory.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "Категория не найдена",
      })
    }

    return res.status(200).json(updatedCategory[0])
  } catch (error) {
    console.error("Ошибка при обновлении категории:", error)
    res.status(500)
    next(error)
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Неверный ID категории",
      })
    }

    const deletedCategory = await db.delete(category).where(eq(category.id, id)).returning()

    if (deletedCategory.length === 0 || !deletedCategory[0]) {
      return res.status(404).json({
        error: "Not Found",
        message: "Категория не найдена",
      })
    }
    const folderPath = path.join(process.cwd(), "uploads", "categories", slugGenerator(deletedCategory[0].name))
    await deleteFolder(folderPath)

    return res.status(200).json({ message: "Категория удалена" })
  } catch (error) {
    console.error("Ошибка при удалении категории:", error)
    res.status(500)
    next(error)
  }
}
