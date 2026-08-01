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

首次启动后需通过 API 完成初始化（见下方「初始化」一节），之后主题通过 API 上传安装。

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

## 日常更新主题

```powershell
# 1. 打包
powershell -ExecutionPolicy Bypass -File pack.ps1

# 2. 复制进容器
docker cp time-capsule-1.9.1.zip halo-dev:/tmp/theme.zip

# 3. 上传安装（需先登录拿 cookie，或直接在后台 UI 上传）
docker exec halo-dev sh -c "curl -s -b /tmp/ck.txt -X POST http://127.0.0.1:8090/apis/api.console.halo.run/v1alpha1/themes/install -F 'file=@/tmp/theme.zip'"
```

注意：容器重启后 `/tmp/ck.txt` 丢失，需重新走 RSA 登录流程。也可以直接在浏览器后台「外观 → 主题 → 上传」操作。

---

## 打包主题不受 Docker 影响

`pack.ps1` 只打包 `theme.yaml`、`settings.yaml`、`annotation-settings.yaml` 和 `templates/` 目录。`docker-compose.yml` 和本文档不在打包范围内，不影响主题 zip。
