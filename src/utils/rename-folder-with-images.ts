import { eq } from "drizzle-orm"
import fs from "fs"
import path from "path"
import { db } from "../db"
import { category, product } from "../db/models"
import { slugGenerator } from "./slug-generator"

/**
 * Переименовывает папку с изображениями и обновляет пути в базе данных
 * @param newName - новое имя (будет преобразовано в slug)
 * @param type - тип сущности: "products" или "categories"
 * @param entityId - ID сущности (продукта или категории)
 * @returns массив обновлённых путей к изображениям
 */
export async function renameFolderWithImages(
  newName: string,
  type: "products" | "categories",
  entityId: number,
): Promise<string[]> {
  const newSlug = slugGenerator(newName)
  const uploadsDir = path.join(process.cwd(), "uploads")

  // Получаем текущий slug из пути изображения в БД
  let currentSlugInPath: string | null = null

  if (type === "categories") {
    const currentCategory = await db.query.category.findFirst({
      where: eq(category.id, entityId),
    })
    if (!currentCategory) {
      console.log(`Категория с ID ${entityId} не найдена`)
      return []
    }
    const match = currentCategory.image.match(/\/api\/uploads\/categories\/([^/]+)\//)
    currentSlugInPath = match?.[1] ?? null
  } else {
    const currentProduct = await db.query.product.findFirst({
      where: eq(product.id, entityId),
    })
    if (!currentProduct || currentProduct.images.length === 0) {
      console.log(`Продукт с ID ${entityId} не найден или не имеет изображений`)
      return []
    }
    const match = currentProduct.images[0]!.match(/\/api\/uploads\/products\/([^/]+)\//)
    currentSlugInPath = match?.[1] ?? null
  }

  if (!currentSlugInPath) {
    console.log(`Не удалось извлечь текущий slug из пути изображения`)
    return []
  }

  console.log(`Текущий slug в пути: "${currentSlugInPath}", новый slug: "${newSlug}"`)

  // Если slug не изменился - ничего не делаем
  if (currentSlugInPath === newSlug) {
    console.log(`Slug не изменился, пропускаем`)
    return []
  }

  const oldFolderPath = path.join(uploadsDir, type, currentSlugInPath)
  const newFolderPath = path.join(uploadsDir, type, newSlug)

  // Переименовываем папку, если она существует
  if (fs.existsSync(oldFolderPath)) {
    // Проверяем, не существует ли уже папка с новым именем
    if (fs.existsSync(newFolderPath)) {
      throw new Error(`Папка с именем "${newSlug}" уже существует`)
    }
    fs.renameSync(oldFolderPath, newFolderPath)
    console.log(`Папка переименована с "${currentSlugInPath}" на "${newSlug}"`)
  } else {
    console.log(`Папка "${oldFolderPath}" не существует, пропускаем переименование файловой системы`)
  }

  // Обновляем пути в базе данных
  if (type === "products") {
    return await updateProductImagePaths(currentSlugInPath, newSlug, entityId)
  } else {
    return await updateCategoryImagePath(currentSlugInPath, newSlug, entityId)
  }
}

/**
 * Обновляет пути к изображениям продукта в БД
 * @returns массив обновлённых путей
 */
async function updateProductImagePaths(oldSlug: string, newSlug: string, productId: number): Promise<string[]> {
  // Получаем текущий продукт
  const currentProduct = await db.query.product.findFirst({
    where: eq(product.id, productId),
  })

  if (!currentProduct) {
    return []
  }

  // Заменяем пути в массиве images
  const updatedImages = currentProduct.images.map(img => {
    const match = img.match(/\/api\/uploads\/products\/([^/]+)\//)
    if (match) {
      return img.replace(`/api/uploads/products/${match[1]}/`, `/api/uploads/products/${newSlug}/`)
    }
    return img
  })

  // Обновляем в БД
  try {
    await db.update(product).set({ images: updatedImages }).where(eq(product.id, productId))
    return updatedImages
  } catch (error) {
    console.error(`[updateProductImagePaths] Ошибка при обновлении БД:`, error)
    return []
  }
}

/**
 * Обновляет путь к изображению категории в БД
 * @returns массив с обновлённым путём (один элемент)
 */
async function updateCategoryImagePath(oldSlug: string, newSlug: string, categoryId: number): Promise<string[]> {
  // Получаем текущую категорию
  const currentCategory = await db.query.category.findFirst({
    where: eq(category.id, categoryId),
  })

  if (!currentCategory) {
    return []
  }

  const match = currentCategory.image.match(/\/api\/uploads\/categories\/([^/]+)\//)

  if (!match) {
    return []
  }
  const currentSlugInPath = match[1]

  // Заменяем путь
  const updatedImage = currentCategory.image.replace(
    `/api/uploads/categories/${currentSlugInPath}/`,
    `/api/uploads/categories/${newSlug}/`,
  )

  // Обновляем в БД
  try {
    await db.update(category).set({ image: updatedImage }).where(eq(category.id, categoryId))
    return [updatedImage]
  } catch (error) {
    console.error(`[updateCategoryImagePath] Ошибка при обновлении БД:`, error)
    return []
  }
}
