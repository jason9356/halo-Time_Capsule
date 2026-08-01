# 本地 Docker 测试环境 · 踩坑记录

> 环境：Windows 11 + Docker Desktop 29.x + Halo 2.22
> 整理日期：2026-08-01

---

## 快速启动

```powershell
docker compose up -d
# 前台 http://localhost:8090
# 后台 http://localhost:8090/console  (admin / admin123)
```

`docker-compose.yml` 已把**本仓库根目录**挂到容器内 `themes/time-capsule`，并关闭 Thymeleaf 缓存：

- 改 `templates/**/*.html` → 浏览器 **Ctrl+F5** 即可
- 改 `templates/assets/css|js` → 同上（若仍旧，清缓存或临时改 `theme.yaml` version 骗过 `?v=`）
- 改 `settings.yaml` → 后台「外观 → 主题 → **重载主题配置**」
- **日常小改不要 bump version**；功能凑一轮再用 `pack.ps1` 打正式包上传生产站

首次启动后需完成初始化（见下），并在后台启用「时间容器」主题（挂载后目录已在，可能仍要点一次启用/重载）。

```powershell
# 改过 compose 挂载后需要重建容器（数据卷保留）
docker compose up -d --force-recreate
```

---

## 坑 1：Docker Hub 拉不下来

**现象**：`docker pull halohub/halo:2.22` 超时，报 `dial tcp ... connectex: A connection attempt failed`。

**原因**：Docker Desktop 的 daemon 不走系统代理。即使 `daemon.json` 配了 `registry-mirrors`，镜像站本身也可能挂。

**解决**：
1. 开本地代理（Clash/v2ray 等）
2. Docker Desktop → Settings → Resources → Proxies → 填 `http://127.0.0.1:<端口>`，Apply & Restart
3. 或者直接用镜像站前缀：`docker pull docker.1ms.run/halohub/halo:2.22`（拉到后 `docker tag` 回原名）

---

## 坑 2：环境变量自动创建管理员没生效

**现象**：`docker-compose.yml` 里配了 `HALO_SECURITY_INITIALIZER_SUPERADMINUSERNAME/PASSWORD`，但启动后访问 `/login` 仍 302 到 `/system/setup`。

**原因**：Halo 2.22 的环境变量初始化在某些版本/镜像构建下不触发，仍需走 setup 流程。

**解决**：手动 POST setup 表单（不需要 RSA，setup 页面是明文提交）：

```sh
# 先 GET /system/setup 拿 CSRF cookie
curl -s -c /tmp/ck.txt http://127.0.0.1:8090/system/setup > /tmp/setup.html
CSRF=$(sed -n 's/.*name="_csrf" value="\([^"]*\)".*/\1/p' /tmp/setup.html)

# POST 表单
curl -s -b /tmp/ck.txt -c /tmp/ck.txt -X POST http://127.0.0.1:8090/system/setup \
  -d "_csrf=$CSRF" \
  -d "language=zh-CN" \
  -d "externalUrl=http://localhost:8090" \
  -d "siteTitle=时间容器" \
  -d "username=admin" \
  -d "email=admin@local.dev" \
  -d "password=admin123"
# 返回 204 即成功
```

---

## 坑 3：登录需要 RSA 加密密码

**现象**：直接 POST 明文密码到 `/login` 返回 302 → `/login?error=invalid-credential`。

**原因**：Halo 2.22 登录页内嵌 RSA 公钥，前端 JS 先加密再提交。服务端拒绝明文。

**解决**（容器内有 openssl）：

```sh
# 1. GET /login 拿 CSRF + publicKey
# 2. 公钥写 PEM
echo "-----BEGIN PUBLIC KEY-----" > /tmp/pub.pem
echo "$PUBKEY" | fold -w 64 >> /tmp/pub.pem
echo "-----END PUBLIC KEY-----" >> /tmp/pub.pem

# 3. 加密
ENC_PWD=$(printf "admin123" | openssl pkeyutl -encrypt -pubin -inkey /tmp/pub.pem | base64 -w0)

# 4. POST /login
curl -s -b /tmp/ck.txt -c /tmp/ck.txt -X POST http://127.0.0.1:8090/login \
  -d "username=admin" \
  --data-urlencode "password=$ENC_PWD" \
  --data-urlencode "_csrf=$CSRF"
# 302 → /console 即成功
```

注意：公钥 JSON 里有 `\/` 转义，提取后需 `sed 's|\\/|/|g'`。

---

## 坑 4：PowerShell 5.1 没有 ImportSubjectPublicKeyInfo

**现象**：试图在宿主机 PowerShell 里用 .NET RSA 加密，报 `MethodNotFound`。

**原因**：PowerShell 5.1 底层是 .NET Framework 4.x，`RSACryptoServiceProvider` 没有 `ImportSubjectPublicKeyInfo`（那是 .NET Core 3.0+ / .NET 5+ 的 API）。

**解决**：不在宿主机做 RSA，改为 `docker exec` 进容器用 openssl 完成。

---

## 坑 5：容器内 sh 是 busybox/dash

**现象**：
- `grep -oP`（Perl 正则）不可用
- `${var:0:20}` 子串语法报 `Bad substitution`
- 多行 heredoc 里 PowerShell 引号嵌套全部炸掉

**解决**：
- 用 `sed -n 's/pattern/\1/p'` 替代 `grep -oP`
- 用 `echo "$VAR" | wc -c` 替代子串
- 脚本写到宿主机文件 → `docker cp` 进容器 → `docker exec sh /tmp/xxx.sh`
- 脚本进容器后先 `sed -i 's/\r$//'` 去 Windows 换行符

---

## 坑 6：创建文章 API 400

**现象**：POST `/apis/api.console.halo.run/v1alpha1/posts` 返回 400 `Failed to read HTTP message`。

**原因**（逐个排查）：
1. `excerpt` 不是字符串而是对象 `{"autoGenerate":false,"raw":"..."}`
2. `spec` 缺少必填字段 `"deleted": false`
3. `content` 对象必须同时提供 `raw` 和 `content` 两个字段（都填 HTML），只给 `raw` 会导致前端 `post.content.content` 为空（页面能打开但正文区域空白）

**最终可用的 JSON 结构**：

```json
{
  "post": {
    "spec": {
      "title": "标题",
      "slug": "slug",
      "categories": ["cat-xxx"],
      "tags": ["tag-1"],
      "deleted": false,
      "pinned": false,
      "publish": true,
      "allowComment": true,
      "visible": "PUBLIC",
      "priority": 0,
      "excerpt": { "autoGenerate": true, "raw": "" },
      "htmlMetas": []
    },
    "apiVersion": "content.halo.run/v1alpha1",
    "kind": "Post",
    "metadata": { "generateName": "post-" }
  },
  "content": {
    "raw": "<p>正文 HTML</p>",
    "content": "<p>正文 HTML</p>",
    "rawType": "HTML"
  }
}
```

> `raw` 和 `content` 填相同内容即可。`rawType` 为 `"HTML"` 时 Halo 不会自动从 raw 生成 content。

---

## 坑 7：分类 children 写不进去

**现象**：创建子分类后，PUT 父分类加 `children` 数组返回 500。

**原因**：PUT 扩展资源需要 `metadata.version` 做乐观锁，缺了会 500。

**解决**：先 GET 拿到当前 `version`，PUT 时带上：

```json
"metadata": {
  "name": "cat-yue-du",
  "version": 1,
  "finalizers": ["category-protection"]
}
```

---

## 日常开发（推荐：挂载，不打包）

本地改文件 → 刷新 `http://localhost:8090`。Agent 也可直接改仓库，效果同样进 Docker。

仅当挂载异常、或要验证「上传 zip」路径时，才走打包安装：

```powershell
powershell -ExecutionPolicy Bypass -File pack.ps1
# 浏览器后台：外观 → 主题 → 上传
# 或 docker cp + install API（需先登录拿 cookie）
```

容器重启后 `/tmp/ck.txt` 会丢，需重新登录。

---

## 版本策略（重要：关系到浏览器缓存）

模板引用资源带 `?v=${theme.spec.version}`，浏览器按完整 URL 缓存。**version 不变 → URL 不变 → 浏览器用旧缓存**，改了 CSS 也看不到（硬刷新也可能被强缓存挡住）。

| 场景 | 要不要改 version |
|------|------------------|
| 本地 Docker 调样式/文案/小逻辑 | **要**（否则浏览器缓存不失效，看不到改动） |
| 准备上传生产 / 给别人安装的 zip | **要**（如 1.9.1 → 1.9.2） |
| 仅 commit 存档 | 可不改 |

**关键坑**：`theme.spec.version` 存在 Halo 数据库里，改 `theme.yaml` 的 version **不会自动生效**（重启容器也不重读）。改完 version 后必须登录 PUT 更新 Theme 资源：

```sh
# 1. GET 拿当前 metadata.version（乐观锁用）
curl -s -b /tmp/ck.txt http://127.0.0.1:8090/apis/theme.halo.run/v1alpha1/themes/time-capsule
# 2. PUT 回去：spec.version 填新值，metadata.version 填第 1 步拿到的数字
```

PUT 成功后 `?v=` 变成新 URL，浏览器普通刷新即拉新 CSS。

---

## 打包主题不受 Docker 影响

`pack.ps1` 只打包 `theme.yaml`、`settings.yaml`、`annotation-settings.yaml` 和 `templates/`。`docker-compose.yml` 与本文档不进 zip。
