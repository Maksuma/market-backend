import fs from "fs"
import path from "path"
import { slugGenerator } from "./slug-generator"

export async function moveImagesFromTemp(
  productName: string,
  imageUrls: string[],
  folderName: string,
): Promise<string[]> {
  const productSlug = slugGenerator(productName)
  const uploadsDir = path.join(process.cwd(), "uploads")
  const productDir = path.join(uploadsDir, folderName, productSlug)

  if (!fs.existsSync(productDir)) {
    fs.mkdirSync(productDir, { recursive: true })
  }
  const movedImageUrls: string[] = []

  for (const url of imageUrls) {
    if (url.includes("/temp-product/")) {
      const filename = path.basename(url)
      const tempImagePath = path.join(uploadsDir, folderName, "temp-product", filename)
      const newImagePath = path.join(productDir, filename)
      if (fs.existsSync(tempImagePath)) {
        fs.renameSync(tempImagePath, newImagePath)
        const newImageUrl = `/api/uploads/${folderName}/${productSlug}/${filename}`
        movedImageUrls.push(newImageUrl)
      } else {
        console.warn(`Temp image not found: ${tempImagePath}`)
      }
    } else {
      movedImageUrls.push(url)
    }
  }

  return movedImageUrls
}
