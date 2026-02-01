import { relations } from "drizzle-orm"
import { pgTable, serial, text } from "drizzle-orm/pg-core"
import { product } from "./Product"

export const category = pgTable("category", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  linkName: text("link_name").notNull(),
  specifications: text("specifications").array(),
  image: text("image").notNull(),
})

export const categoryRelations = relations(category, ({ many }) => ({
  products: many(product),
}))

export type TCategory = typeof category.$inferSelect
