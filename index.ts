import app from "./src/app"

const PORT = process.env.PORT

if (!PORT) {
  throw new Error("PORT environment variable is not set")
}

app.listen(PORT, err => {
  if (err) {
    console.error("Error starting server:", err)
  }
  console.log(`Better Auth app listening on port ${PORT}`)
})
