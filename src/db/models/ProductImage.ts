import { relations } from "drizzle-orm"
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { product } from "./Product"

export const productImage = pgTable(
  "product_image",
  {
    id: serial("id").primaryKey(),
    productId: serial("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("product_image_productId_idx").on(table.productId), index("product_image_order_idx").on(table.order)],
)

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
}))

export type TProductImage = typeof productImage.$inferSelect
