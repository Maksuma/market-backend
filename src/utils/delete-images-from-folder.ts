import fs from "fs"

export async function deleteImagesFromFolder(folderPath: string, images: string[]): Promise<void> {
  const deletePromises = images.map(image => {
    const imagePath = `${folderPath}/${image.split("/").pop()}`
    console.log(`Deleting image: ${imagePath}`)
    return new Promise<void>((resolve, reject) => {
      fs.unlink(imagePath, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          if (err.code === "ENOENT") {
            return resolve()
          }
          return reject(err)
        }
        resolve()
      })
    })
  })
  await Promise.all(deletePromises)
}

export async function deleteFolder(folderPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.rm(folderPath, { recursive: true }, (err: NodeJS.ErrnoException | null) => {
      if (err) {
        if (err.code === "ENOENT") {
          return resolve()
        }
        return reject(err)
      }
      resolve()
    })
  })
}
