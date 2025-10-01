import crypto from 'crypto';
import axios from 'axios';
import { supabaseAdmin } from './external/supabaseAdmin.js';
import { getGoogleJwksKey } from '../utils/googleJwks.js';
import jwt from 'jsonwebtoken';
import { importJWK, jwtVerify } from 'jose';

/**
 * =============================================================================
 * 1. 配置与内存存储
 * =============================================================================
 * 这部分定义了认证流程所需的常量和临时数据存储。
 * 注意：在生产环境中，这些内存存储应替换为持久化数据库（如 Redis），以防止服务重启导致数据丢失。
 */

// 用于存储认证第一步生成的 state 和 codeVerifier，以在回调时验证，防止 CSRF 攻击。
const pendingStates = new Map(); // 键: state, 值: { codeVerifier, createdAt, deviceId }
// 用于存储一次性令牌，安全地将认证结果从浏览器交接给移动应用。
const oneTimeTokens = new Map(); // 键: ott, 值: { userId, name, picture, createdAt }
// 用于存储有效的刷新令牌，管理用户会话。
const refreshStore = new Map(); // 键: refreshToken, 值: { userId, sessionId, createdAt }

// 从环境变量中读取 Google OAuth 客户端的配置信息。
const GOOGLE_AUTH = {
  clientId: process.env.GOOGLE_WEB_CLIENT_ID,
  clientSecret: process.env.GOOGLE_WEB_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_BACKEND_REDIRECT, // e.g. https://api.example.com/api/auth/google/callback
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token'
};

// 定义用于唤醒移动应用的深层链接（Deep Link）格式。
const APP_DEEP_LINK_SCHEME = process.env.APP_DEEP_LINK_SCHEME || 'miffler';
const APP_DEEP_LINK_PATH = process.env.APP_DEEP_LINK_PATH || 'oauth-complete';

/**
 * 定义用于签发和验证应用内部 JWT 的对称密钥 (Symmetric Secret)。
 * 在生产环境中，必须通过环境变量设置一个固定的、强随机的密钥。
 * 动态生成的密钥会导致服务重启后所有用户会话失效，并且无法在多实例环境中工作。
 */
let INTERNAL_JWT_SECRET = process.env.INTERNAL_JWT_SECRET || process.env.INTERNAL_JWT_PRIVATE;
if (!INTERNAL_JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: INTERNAL_JWT_SECRET environment variable is not set in production!');
  }
  INTERNAL_JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('Warning: INTERNAL_JWT_SECRET is not set. Using a temporary, dynamically generated key. All sessions will be lost on restart.');
}

/**
 * =============================================================================
 * 2. 辅助函数
 * =============================================================================
 * 这些是实现 OAuth 2.0 和 PKCE 流程所需的加密和随机字符串生成函数。
 */

// 生成 PKCE 的 code_verifier。
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
// 根据 code_verifier 生成 code_challenge。
function codeChallengeFromVerifier(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// 生成用于 CSRF 防护的随机 state 字符串。
function randomState() {
  return crypto.randomBytes(16).toString('hex');
}
// 生成一次性令牌 (One-Time Token)。
function randomOtt() {
  return crypto.randomBytes(20).toString('base64url');
}
// 生成会话 ID。
function randomSessionId() {
  return crypto.randomBytes(18).toString('base64url');
}

/**
 * =============================================================================
 * 3. 认证流程 - 阶段一: 开始认证
 * =============================================================================
 * 移动应用调用此函数，获取一个 Google 授权 URL。
 */
export async function startAuth({ deviceId }) {
  if (!GOOGLE_AUTH.clientId || !GOOGLE_AUTH.redirectUri) throw new Error('google auth env missing');
  
  // 1. 生成 PKCE 参数 (code verifier 和 challenge)。
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeChallengeFromVerifier(codeVerifier);
  
  // 2. 生成 state 参数用于防止 CSRF 攻击。
  const state = randomState();
  
  // 3. 将 state 和 codeVerifier 存入内存，以便在回调阶段进行验证。
  pendingStates.set(state, { codeVerifier, createdAt: Date.now(), deviceId });
  const params = new URLSearchParams({
    client_id: GOOGLE_AUTH.clientId,
    redirect_uri: GOOGLE_AUTH.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  });
  
  // 4. 构建完整的 Google 授权 URL 并返回给客户端。
  const authorizationUrl = `${GOOGLE_AUTH.authEndpoint}?${params.toString()}`;
  return { authorizationUrl, state };
}

/**
 * =============================================================================
 * 4. 认证流程 - 阶段二: 处理 Google 回调
 * =============================================================================
 * 用户在 Google 页面授权后，Google 会携带 code 和 state 重定向到此流程。
 * 此阶段包含多个子步骤：交换授权码、验证 ID Token、创建/更新用户、生成深层链接。
 */

// 子步骤 4.1: 使用授权码 (code) 和 code_verifier 向 Google 换取令牌。
async function exchangeCode({ code, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: GOOGLE_AUTH.clientId,
    client_secret: GOOGLE_AUTH.clientSecret || '',
    redirect_uri: GOOGLE_AUTH.redirectUri,
    code_verifier: codeVerifier
  });

  // 在 TUN 模式下，系统会自动处理网络代理，代码中无需也-不应-进行任何代理设置。
  // 我们移除所有手动的 proxy 配置，让 axios 发起一个标准的网络请求。
  const resp = await axios.post(GOOGLE_AUTH.tokenEndpoint, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return resp.data; // { access_token, refresh_token, id_token, expires_in, ... }
}

// 子步骤 4.2: 验证从 Google 获取的 id_token 的合法性。
async function verifyIdToken(idToken) {
  // 解码 JWT 以获取 header 和 payload。
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) throw new Error('invalid_id_token');
  const { header, payload } = decoded;
  
  // 检查 'aud' (Audience) 字段，确保令牌是颁发给本应用的。
  if (payload.aud !== GOOGLE_AUTH.clientId) throw new Error('aud_mismatch');
  // 检查 'iss' (Issuer) 字段，确保令牌是由 Google 颁发的。
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new Error('iss_mismatch');
  // 检查 'exp' (Expiration) 字段，确保令牌未过期。
  if (payload.exp * 1000 < Date.now() - 30000) throw new Error('id_token_expired');
  
  // 根据 token header 中的 'kid' (Key ID)，获取对应的 Google 公钥。
  const jwk = await getGoogleJwksKey(header.kid); // now returns JWK object instead of PEM
  // 使用公钥验证 JWT 签名。
  const key = await importJWK(jwk, 'RS256');
  await jwtVerify(idToken, key, { algorithms: ['RS256'], audience: GOOGLE_AUTH.clientId, issuer: payload.iss });
  return payload; // contains sub, email, name, picture
}

// 子步骤 4.3: 根据 id_token 中的用户信息，在数据库中创建或更新用户记录。
async function upsertUserFromIdToken(payload) {
  // Using Supabase profile table; adapt as needed.
  // 'profiles' table should have a unique constraint on 'provider_sub'
  const { sub, email, name, picture } = payload;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        provider: 'google',
        provider_sub: sub,
        email: email,
        full_name: name,
        avatar_url: picture,
      },
      { onConflict: 'provider, provider_sub', ignoreDuplicates: false }
    )
    .select('id, email, full_name, avatar_url')
    .single();

  if (error) throw error;
  return { id: data.id, email: data.email, name: data.full_name, picture: data.avatar_url };
}

// 阶段二主函数：处理 Google 回调的完整流程。
export async function handleGoogleCallback({ code, state }) {
  // 1. 验证 state，防止 CSRF。
  const st = pendingStates.get(state);
  if (!st) throw new Error('state_not_found');
  pendingStates.delete(state);
  if (Date.now() - st.createdAt > 5 * 60 * 1000) throw new Error('state_expired');
  
  // 2. 交换授权码，获取 Google 令牌。
  const tokenData = await exchangeCode({ code, codeVerifier: st.codeVerifier });
  
  // 3. 验证 id_token。
  const idPayload = await verifyIdToken(tokenData.id_token);
  
  // 4. 在数据库中创建或更新用户。
  const user = await upsertUserFromIdToken(idPayload);
  
  // 5. (可选) 如果 Google 提供了 refresh_token，将其存储起来用于未来的会话刷新。
  const sessionId = randomSessionId();
  if (tokenData.refresh_token) {
    // store encrypted ideally; here plain for prototype
    refreshStore.set(tokenData.refresh_token, { userId: user.id, sessionId, createdAt: Date.now() });
  }
  
  // 6. 生成一个一次性令牌 (OTT)，并与用户信息关联存储。
  const ott = randomOtt();
  oneTimeTokens.set(ott, { userId: user.id, name: user.name || user.email || 'User', picture: user.picture || null, createdAt: Date.now() });
  
  // 7. 构建一个包含 OTT 的深层链接，用于从浏览器唤醒移动应用。
  const deepLink = `${APP_DEEP_LINK_SCHEME}://${APP_DEEP_LINK_PATH}?ott=${encodeURIComponent(ott)}`;
  return deepLink;
}

/**
 * =============================================================================
 * 5. 认证流程 - 阶段三: 完成认证
 * =============================================================================
 * 移动应用被深层链接唤醒后，使用 OTT 调用此函数，换取应用内部的认证凭证。
 */

// 辅助函数：签发应用内部的 Access Token (短时效)。
function signInternalAccess(userId, sessionId) {
  return jwt.sign({ sub: userId, sid: sessionId, typ: 'access' }, INTERNAL_JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}
// 辅助函数：签发应用内部的 Refresh Token (长时效)。
function signInternalRefresh(userId, sessionId) {
  return jwt.sign({ sub: userId, sid: sessionId, typ: 'refresh' }, INTERNAL_JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
}

export async function finishAuth({ ott }) {
  // 1. 验证一次性令牌 (OTT) 的有效性。
  const data = oneTimeTokens.get(ott);
  if (!data) throw new Error('invalid_ott');
  oneTimeTokens.delete(ott);
  if (Date.now() - data.createdAt > 60 * 1000) throw new Error('ott_expired');
  
  // 2. 为用户签发应用内部的 Access Token 和 Refresh Token。
  const sessionId = randomSessionId();
  const accessToken = signInternalAccess(data.userId, sessionId);
  const refreshToken = signInternalRefresh(data.userId, sessionId);
  
  // 3. 存储新的 Refresh Token 以管理会话。
  refreshStore.set(refreshToken, { userId: data.userId, sessionId, createdAt: Date.now() });
  
  // 4. 将令牌和用户信息返回给移动应用。
  return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 900, user: { id: data.userId, name: data.name, picture: data.picture } };
}

/**
 * =============================================================================
 * 6. 会话管理
 * =============================================================================
 * 提供登出和刷新令牌的功能。
 */

// 登出：使指定的 Refresh Token 失效。
export async function logoutSession({ refreshToken }) {
  refreshStore.delete(refreshToken);
}

// 刷新令牌：使用有效的 Refresh Token 获取一个新的 Access Token。
export async function refreshInternal({ refreshToken }) {
  const meta = refreshStore.get(refreshToken);
  if (!meta) throw new Error('invalid_refresh');
  // 验证 Refresh Token 本身是否过期。
  try {
    jwt.verify(refreshToken, INTERNAL_JWT_SECRET);
  } catch (e) {
    refreshStore.delete(refreshToken);
    throw new Error('refresh_expired');
  }
  // 签发一个新的 Access Token。
  const accessToken = signInternalAccess(meta.userId, meta.sessionId);
  return { accessToken, expiresIn: 900, tokenType: 'Bearer' };
}
