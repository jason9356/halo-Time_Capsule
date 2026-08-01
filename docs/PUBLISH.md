# Halo 应用市场上架指南

> 目标版本：v1.9.6 · 整理日期：2026-08-01
> 官方文档：[发布应用](https://docs.halo.run/developer-guide/app-store/publish-app) · [审核指南](https://docs.halo.run/developer-guide/app-store/app-review-guidelines)

---

## 0. 已在本仓库准备好的（本次会话完成）

| 事项 | 状态 | 说明 |
|---|---|---|
| `theme.yaml` 元数据 | ✅ | repo/issues/homepage 已指向 GitHub，logo 指向仓库内 seal.png，license 指向仓库 LICENSE |
| `LICENSE`（GPL-3.0 全文） | ✅ | 新增 |
| `templates/page.html` 单页模板 | ✅ | 已实测渲染正常（审核 4.4.1 硬要求） |
| 预览截图 | ✅ | `docs/screenshots/` 下 4 张真实界面图（桌面首页/文章页/移动端/暗色） |
| `README.md` | ✅ | 已加截图、第三方披露、卸载、故障排查、许可证章节 |
| `package.json` + `.github/workflows/cd.yaml` | ✅ | GitHub Actions 自动打包发布（可后启用） |
| `.gitignore` | ✅ | 已排除 `__pycache__/` |

**尚未做（需要你）**：git 提交推送到 GitHub、创建 Release、申请开发者、在应用市场创建应用。

---

## 1. 提交代码到 GitHub

```powershell
# 1) 解除已误跟踪的 Python 缓存文件（只从 git 移除，不删本地文件）
git rm -r --cached tools/book-fill/__pycache__

# 2) 查看改动确认
git status

# 3) 提交并推送
git add -A
git commit -m "Prepare app store release: metadata, LICENSE, single page template, screenshots"
git push origin main
```

推送后在 GitHub 仓库页 → Settings → **Topics** 添加 `halo-theme`（官方推荐，便于被搜索）。

---

## 2. 创建 GitHub Release（提供可安装的 zip）

> 首次上架建议**手动上传** pack.ps1 生成的 zip（已校验内容干净）；CD 工作流可之后启用。

```powershell
# 1) 本地打包（读 theme.yaml 的 version，生成 time-capsule-1.9.6.zip）
powershell -ExecutionPolicy Bypass -File pack.ps1

# 2) 在 GitHub 仓库页面创建 Release：
#    - Tag: v1.9.6（选 main）
#    - 标题：v1.9.6
#    - 说明：列出本次更新点（如「新增单页模板、双印按钮、书单墙对齐」）
#    - 上传附件：time-capsule-1.9.6.zip
#    - 勾选 Set as the latest release，发布
```

> 验证 zip：解包后应只有 `theme.yaml`、`settings.yaml`、`annotation-settings.yaml`、`templates/`（pack.ps1 已确保），不包含 docs/tools/旧 zip。

---

## 3. 申请成为应用市场开发者

1. 用已完成邮箱验证的 Halo 官网账号，打开 <https://www.halo.run/uc/developer/join>
2. 填写开发者资料，阅读并同意开发者协议，提交
3. 等待审核通过（通过后在 <https://www.halo.run/uc/developer/apps> 创建应用）

---

## 4. 创建应用（应用管理页）

打开 <https://www.halo.run/uc/developer/apps> → 创建应用：

| 字段 | 填写 |
|---|---|
| 应用类型 | 主题 |
| 名称 | 时间容器 |
| 简介 | 书卷气、高密度、为长期写作而生的个人图书馆式 Halo 主题。 |
| Logo | 上传 `templates/assets/img/seal.png`（1024×1024） |
| 截图 | 上传 `docs/screenshots/` 下 4 张图（真实界面，符合 2.2 要求） |
| README | 填仓库 README 内容（或链接） |
| 许可证 | GPL-3.0（对应仓库 LICENSE） |
| 开源仓库 | https://github.com/jason9356/halo-Time_Capsule |
| 支持/主页 | https://github.com/jason9356/halo-Time_Capsule/issues |

---

## 5. 创建首个版本

在应用下创建首个版本：

| 字段 | 填写 |
|---|---|
| 版本号 | `1.9.6`（无首尾空白，SemVer 规范） |
| Halo 兼容范围 | `>=2.22.0` |
| 版本说明 | 简要列出功能点与本次更新 |
| 版本制品 | 上传第 2 步的 `time-capsule-1.9.6.zip` |

首次提交前保持**草稿状态**，只保留这一个初始草稿版本。

---

## 6. 自查清单（对照审核指南）

提交前逐项确认：

- [ ] 主题在声明兼容的 Halo（≥2.22.0）上可安装/启用/配置/使用/禁用/卸载
- [ ] 首页、文章页、单页、分类页、标签页、归档页、404 均正常渲染
- [ ] 评论、分页、导航、附件、封面图渲染正常
- [ ] 版本号 `1.9.6`、兼容范围 `>=2.22.0` 格式正确、无首尾空白
- [ ] `theme.yaml` 的 `homepage`/`issues`/`repo`/`license` 已正确指向 GitHub
- [ ] 截图是真实界面，不是营销图/封面图
- [ ] 第三方披露已写明：Navidrome（可选外部服务）、字体（自托管 OFL 许可）
- [ ] 支持链接（GitHub Issues）可访问
- [ ] 主题包不含无关文件（docs/tools/旧 zip/pyc）
- [ ] 无硬编码密钥/密码/令牌

---

## 7. 提交审核

在应用管理页确认信息后提交首次审核（需阅读并同意上架协议）。

- 审核通过 → 应用发布到应用市场。
- 审核被拒 → 按引用条款（如「请参考 2.1」）整改后重新提交。

---

## 8. 发布后维护

**手动发布后续版本**：更新 `theme.yaml` 版本号 → 重新打包 → 在应用管理页发布新版本 → 创建对应 GitHub Release。

**启用 CD 自动同步（可选，首次审核通过后）**：
1. 把 `.github/workflows/cd.yaml` 中 `skip-appstore-release: true` 去掉（或设 false），并在 `with` 加 `app-id: <应用管理页里的应用 ID>`
2. 在 Halo 官网个人中心创建个人令牌，勾选「应用市场开发者 > 版本管理」
3. GitHub 仓库 → Settings → Secrets and variables → Actions → 新建 Secret `HALO_PAT`
4. 在工作流中添加 `secrets: halo-pat: ${{ secrets.HALO_PAT }}`
5. 之后每次 `git tag vX.Y.Z` + 发布 Release，CD 会自动打包并同步到应用市场

---

*主题开发规范与已知坑见 `docs/CONTEXT.md`；本地 Docker 开发环境见 `docs/DOCKER-DEV.md`。*
