import { auth } from "@/utils/auth"
import type { Session, User } from "better-auth"
import { fromNodeHeaders } from "better-auth/node"
import type { NextFunction, Request, Response } from "express"

export interface AuthRequest extends Request {
  user?: User
  session?: Session
}

export const protectedRoute = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })

    if (!session) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Требуется авторизация",
      })
    }

    req.user = session.user
    req.session = session.session

    next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    res.status(500)
    next(error)
  }
}

/**
 * Middleware для проверки роли администратора
 * Должен использоваться после protectedRoute
 */
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Требуется авторизация",
      })
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Требуются права администратора",
      })
    }

    next()
  } catch (error) {
    console.error("Admin middleware error:", error)
    return res.status(403).json({
      error: "Forbidden",
      message: "Ошибка проверки прав доступа",
    })
  }
}
