import { supabaseAdmin } from '../services/external/supabaseAdmin.js';

// 辅助函数：根据 Supabase 的访问令牌解析出用户 ID。
// - token: string | undefined
// - 返回值：解析成功返回用户的 UUID（字符串），解析失败或未找到返回 null。
// 行为说明：
//  - 如果未提供 token，立即返回 null。
//  - 使用 Supabase 管理客户端的 `auth.getUser(token)` 来验证令牌并获取用户对象。
//  - 捕获并记录任何错误，出错时返回 null（中间件将把它视为未认证）。
async function resolveUserIdFromToken(token) {
  if (!token) return null; // 没有令牌 -> 未认证
  try {
    // supabaseAdmin.auth.getUser 期望一个访问令牌并返回用户数据
    const userRes = await supabaseAdmin.auth.getUser(token);
    // userRes.data.user 是预期的结构；这里做访问保护以避免运行时错误
    if (userRes && userRes.data && userRes.data.user) return userRes.data.user.id;
    return null;
  } catch (e) {
    // 记录警告但不抛出异常：中间件会将失败当作“无用户”处理
    console.warn('auth.resolveUserIdFromToken failed', e?.message || e);
    return null;
  }
}

// 中间件工厂：optionalAuth
// - 目的：尝试对请求进行认证并在存在有效令牌时设置 `req.userId`，但无论认证成功与否均允许请求继续。
// - 令牌提取方式：
//   1) 优先查找请求头 `Authorization: Bearer <token>`（不区分大小写）
//   2) 如果没有则回退到 `req.body.token`（适用于通过请求体传递 token 的场景）
// - 成功时：设置 `req.userId = <user id>`
// - 失败时：设置 `req.userId = null` 并调用 next()
export function optionalAuth() {
  return async (req, res, next) => {
    const token = (req.headers && req.headers.authorization && String(req.headers.authorization).replace(/^Bearer\s+/i, '')) || req.body?.token;
    // resolveUserIdFromToken 会处理缺失或无效的令牌并返回 null
    req.userId = await resolveUserIdFromToken(token);
    next();
  };
}

// 中间件工厂：requireAuth
// - 目的：为必须受保护的路由强制执行认证。
// - 令牌提取与 optionalAuth 相同。如果令牌缺失或无效，该中间件会返回 HTTP 401 并带有 JSON 错误信息。
// - 成功时：设置 `req.userId = <user id>` 并调用 next()。
export function requireAuth() {
  return async (req, res, next) => {
    const token = (req.headers && req.headers.authorization && String(req.headers.authorization).replace(/^Bearer\s+/i, '')) || req.body?.token;
    const userId = await resolveUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'invalid_token' });
    req.userId = userId;
    next();
  };
}

// Sniff/src/middleware/auth.js
const authMiddleware = (req, res, next) => {
  // JWT 验证逻辑
  next();
};
