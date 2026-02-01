import { relations } from "drizzle-orm"
import { boolean, integer, jsonb, pgTable, serial, text } from "drizzle-orm/pg-core"
import { category } from "./Category"
import { productImage } from "./ProductImage"
import { review } from "./Review"

export const product = pgTable("product", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  linkName: text("link_name").notNull(),
  description: text("description"),
  specifications: jsonb("specifications").$type<Array<{ name: string; value: string }>>(),
  price: integer("price").notNull(),
  discountPrice: integer("discount_price"),
  atStock: integer("at_stock").notNull(),
  categoryId: serial("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
  colors: text("colors").array(),
  hasColors: boolean("has_colors").default(false).notNull(),
  sizes: text("sizes").array(),
  hasSizes: boolean("has_sizes").default(false).notNull(),
  images: text("images").array().notNull(),
  isPopular: boolean("is_popular").default(false).notNull(),
  reviewsCount: integer("reviews_count").default(0).notNull(),
  rating: integer("rating").default(0).notNull(),
})

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category, {
    fields: [product.categoryId],
    references: [category.id],
  }),
  productImages: many(productImage),
  reviews: many(review),
}))

export type TProduct = typeof product.$inferSelect
export type TProductInsert = typeof product.$inferInsert
