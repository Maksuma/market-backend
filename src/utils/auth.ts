import { db } from "@/db"
import * as schema from "@/db/models"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"

const authUrl = process.env.BETTER_AUTH_URL
const authSecret = process.env.BETTER_AUTH_SECRET

if (!authUrl) {
  throw new Error("BETTER_AUTH_URL environment variable is not set")
}
if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is not set")
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: authSecret,
  trustedOrigins: [authUrl],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 дней
    updateAge: 60 * 60 * 24, // обновлять каждые 24 часа
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 минут кеш
    },
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRole: "admin",
    }),
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
})
