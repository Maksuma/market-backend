import type { NextFunction, Request, Response } from "express"
import fs from "fs"
import multer from "multer"
import path from "path"

const uploadsDir = path.join(process.cwd(), "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

export const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + "-" + file.originalname)
  },
})

export async function uploadImages(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ error: "Файлы не были загружены" })
    }

    const folderName = req.body.type?.split("/").pop() as string
    const tempDir = path.join(uploadsDir, folderName, "temp-product")

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    for (const file of req.files as Express.Multer.File[]) {
      const oldPath = file.path
      const newPath = path.join(tempDir, file.filename)
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath)
      }
    }

    const fileUrls = (req.files as Express.Multer.File[]).map(file => {
      return `/api/uploads/${folderName}/temp-product/${file.filename}`
    })
    res.status(200).json({ urls: fileUrls })
  } catch (error) {
    console.error("Upload error:", error)
    next(error)
  }
}

export async function getImageByName(req: Request, res: Response, next: NextFunction) {
  try {
    const filename = req.params.filename
    const filePath = `./uploads/${filename}`

    res.sendFile(filePath, { root: "." }, function (err) {
      if (err) {
        console.error("File send error:", err)
        res.status(404).json({ error: "Файл не найден" })
      }
    })
  } catch (error) {
    console.error("Get image error:", error)
    res.status(500)
    next(error)
  }
}
