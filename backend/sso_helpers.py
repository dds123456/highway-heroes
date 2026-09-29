"""
DewuClaw SSO — Flask 后端辅助模块

后端用请求头/ Cookie 中的 accessToken 调 SSO 用户信息接口换取用户身份，
用于排行榜「提交成绩」的鉴权与展示。不在此存储 token，不将 token 写入日志。
"""

import functools
import logging

import requests
from flask import g, jsonify, request

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 6  # 秒

# SSO 用户信息接口：与前端 sso-core.js 跨域认证使用的是同一端点，
# 返回 { code: 200, data: { username, realname, avatar, email } }。
SSO_USERINFO_URL = "https://sso.shizhuang-inc.com/api/v1/h5/cas/user/infoNoSensitive"


class SSOError(Exception):
    """SSO 验证失败异常"""
    def __init__(self, message: str, code: int = 401, http_status: int = 401):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


def _extract_token() -> str | None:
    """从请求头或 Cookie 中提取 accessToken"""
    token = request.headers.get('accessToken') or request.headers.get('accesstoken')
    if token:
        return token
    host = request.host.split(':')[0]
    cookie_names = (
        ('accessToken', 't1_accessToken', 'prod_accessToken')
        if host.endswith('.net')
        else ('accessToken', 'prod_accessToken', 't1_accessToken')
    )
    for name in cookie_names:
        token = request.cookies.get(name)
        if token:
            return token
    return None


def get_current_user() -> dict:
    """获取当前请求的用户信息（同请求内缓存一次）。"""
    if hasattr(g, '_sso_user') and g._sso_user is not None:
        return g._sso_user

    token = _extract_token()
    if not token:
        raise SSOError('缺少 accessToken', code=401, http_status=401)

    try:
        resp = requests.get(
            SSO_USERINFO_URL,
            headers={'accessToken': token},
            timeout=REQUEST_TIMEOUT,
            # 内部可信主机回源；容器内较新 OpenSSL 不认平台弱密钥证书
            verify=False,
        )
    except requests.RequestException as e:
        logger.warning('SSO user info request error: %s', e)
        raise SSOError('平台用户接口暂时不可用', code=500, http_status=503)

    if resp.status_code == 401:
        raise SSOError('token 无效或已过期', code=401, http_status=401)

    if not resp.ok:
        logger.warning('SSO user info returned HTTP %d', resp.status_code)
        raise SSOError('平台用户接口异常', code=500, http_status=502)

    try:
        body = resp.json()
    except ValueError:
        logger.warning('SSO user info returned invalid JSON')
        raise SSOError('平台用户接口返回无效响应', code=500, http_status=502)

    code = body.get('code')
    if code == 305 or code == 401:
        raise SSOError('token 已失效', code=401, http_status=401)

    if code != 200:
        logger.warning('SSO user info non-200 body: %s', body)
        raise SSOError(
            body.get('msg') or body.get('description') or '用户接口返回非成功状态',
            code=code or 500,
            http_status=500,
        )

    user = body.get('data')
    if not user:
        raise SSOError('用户信息为空', code=500, http_status=500)

    # 归一化常用字段，供业务层直接使用
    normalized = {
        'username': user.get('username') or user.get('loginName') or '',
        'realname': user.get('realname') or user.get('realName') or user.get('name') or '',
        'avatar': user.get('avatar') or user.get('avatarUrl') or user.get('headImgUrl') or '',
        'email': user.get('email') or '',
    }
    g._sso_user = normalized
    return normalized


def require_sso(f):
    """Flask 路由装饰器：自动校验 SSO token，失败返回 JSON 错误。"""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        try:
            get_current_user()
        except SSOError as e:
            return jsonify({'status': e.code, 'error': str(e)}), e.http_status
        return f(*args, **kwargs)
    return decorated
