# 时间容器 · 设计 / 工程 / 运维备忘

> 从设计到部署的交接精简版。供后续持续优化时对照，不必再翻桌面长文。
> 站点：`https://blog.xybkwd.top` · Halo `2.22.7` · 主题目标版本 v1.1
> 整理日期：2026-07-31

安装与配置见根目录 [README.md](../README.md)。本文只保留**设计约束、API、已知坑、运维要点、待办**。

---

## 1. 产品意图（改 UI 前先读）

不是轻快时间线卡片博客，而是**可写几十年的个人图书馆**：

- 信息密度高；装饰刻意克制，但不能寡淡到线框图
- 「书」是一级信息对象：「阅读」一级分类下，每个**子分类 = 一本书**
- 长文沉浸（道德经、毛选、文学读后感等），衬线正文 + 纸感暖调
- 右下 Navidrome 迷你播放器：不打断阅读，默认不自动播放

气质关键词：书卷气 · 发丝线分区 · 朱砂点缀 · 编辑器感极简。

**克制 ≠ 寡淡**：缺衬线兜底、纸感、印章、书脊色带、微交互时，整站会塌成骨架稿——已踩过坑。

---

## 2. 设计系统（勿随意换皮）

| Token | 值 | 用途 |
|---|---|---|
| `--paper` | `#F7F3EA` | 页面底 |
| `--surface` | `#FCFAF4` | 卡片底 |
| `--hi` | `#F1EADB` | 高亮 / 当前项 |
| `--ink` | `#2E2A24` | 标题 / 正文 |
| `--sub` | `#6E6555` | 元信息 / 摘要 |
| `--line` | `#E3DBC8` | 1px 发丝分隔 |
| `--link` | `#3D4A57` | 链接 / 交互 |
| `--accent` | `#9E3B2E` | 朱砂强调 |

暗色：同一套语义 token 翻转；`prefers-color-scheme` + 顶栏手动切换 + `localStorage`（`tc-theme`）。防闪烁脚本在 `modules/head.html`。

字体：标题/正文 **Noto Serif SC**（兜底 Songti SC / STSong / SimSun）；导航/元信息 **Noto Sans SC**（PingFang / YaHei）。质感：圆角 2–4px、轻阴影、发丝线为主。

实现集中在 `templates/assets/css/theme.css`。

### 页面地图

1. **首页**：masthead（印章 + 站名 + 题记）→ 分类卡 → 精华（置顶）→ 左书单墙 + 右文章流 → 页脚宣言  
2. **分类主页**（有子分类）：筛选条 + 紧凑列表  
3. **书单页**（无子分类）：封面 + 书名 + 该书时间线；封面取分类 `cover`，无则纯色书封  
4. **文章**：衬线正文（约 18px / 行高 1.9 / 首字下沉）+ 侧栏 + 上下篇 + 评论位  
5. **播放器**：收起窄条 ↔ hover 展开（切歌 / 曲名 / 音量）

书单墙别名默认 `yue-du`，见 `settings.yaml` → `basic.book_category_slug`。

---

## 3. Halo 2.22 模板要点

动手前对照官方文档 + `theme-earth`，版本间 finder 写法有差异。

| 用途 | 写法 |
|---|---|
| Finder | `${categoryFinder...}` / `${postFinder...}`（**不要**写成 `#categoryFinder`） |
| 分类树 | `categoryFinder.listAsTree()` |
| 子分类详情 | `categoryFinder.getByNames(category.spec.children)` |
| 面包屑 | `categoryFinder.getBreadcrumbs(category.metadata.name)` |
| 单分类（含准确 postCount） | `categoryFinder.getByName(name)` |
| 正文 | `th:utext="${post.content.content}"` |
| 列表 | `th:each="post : ${posts.items}"` |
| 分页 | `prevUrl` / `nextUrl` / `hasPrevious()` / `hasNext()` |
| 上下篇 | `postFinder.cursor(post.metadata.name)` |
| 归档 | `postFinder.archives(1, size)` |
| 静态资源 | `@{/assets/...}?v=${theme.spec.version}` |
| 主题设置 | `theme.config.<组>.<字段>` |

**category.html 自适应**：`#lists.isEmpty(category.spec.children)` → 空则书单页，非空则分类主页。一套模板，勿拆成两个文件除非有强理由。

---

## 4. 已落地修复（v1.1）与仓库现状

| 问题 | 根因 | 状态 |
|---|---|---|
| 字号偏小 | 基础字号偏低 | ✅ CSS 已上调（正文约 18px 等） |
| 列表右溢 | `1fr` 被不换行长摘要撑破 | ✅ 已用 `minmax(0,1fr)` + `min-width:0` |
| 书单墙篇数全 0 | `listAsTree()` 子节点 `postCount` 不可信 | ✅ v1.2 已用 `getByName` |
| 标签链接 404 | 缺少 `tag.html` / `tags.html` | ✅ v1.2 已补 |
| 音乐播不出 | HTTPS 页请求 HTTP Navidrome → 混合内容 | ✅ 运维侧已用 `https://music.xybkwd.top` 反代；前端有 Console 排查日志 |

> 若篇数修对后仍为 0：检查文章是否勾选挂到对应「书」子分类。

---

## 5. 音乐 / CORS（运维备忘，无密钥）

架构（当前生效）：

```
博客 HTTPS (blog.xybkwd.top)
  → 推荐同域：https://blog.xybkwd.top/tc-music/...
  → 或直连：  https://music.xybkwd.top/...
      → 东京 Caddy（剥掉 X-Forwarded-*）→ 北京 Navidrome :4533
```

要点：

1. **混合内容**：不要填裸 HTTP IP。优先填 `https://blog.xybkwd.top/tc-music`。  
2. **DNSPod 拦截坑（2026-07-31）**：Caddy 默认带上 `X-Forwarded-*` 时，北京侧会 302 到 `dnspod.qcloud.com/static/webblock.html`，浏览器表现为 `Failed to fetch`。反代须：

```caddyfile
reverse_proxy 81.70.93.78:4533 {
  header_up -X-Forwarded-For
  header_up -X-Forwarded-Proto
  header_up -X-Forwarded-Host
  header_up -Forwarded
  header_up Host {http.reverse_proxy.upstream.hostport}
}
```

3. **CORS 不要双写**：Caddy 不要再加 `Access-Control-Allow-Origin`。  
4. 凭证走 Subsonic URL 参数（`enc:hex`），务必用**只读账号**。  
5. 排查：

```bash
curl -s -D - -o /dev/null \
  "https://music.xybkwd.top/rest/ping.view?u=USER&p=PASS&v=1.16.1&c=test&f=json" \
  -H "Origin: https://blog.xybkwd.top" | grep -iE 'HTTP/|Access-Control|Location'
# 预期 HTTP 200，且仅一条 Access-Control-Allow-Origin: *，不能出现 dnspod webblock
```

播放器逻辑：`templates/assets/js/player.js`；配置注入：`templates/modules/player.html`。

---

## 6. 工程教训（优化时别再踩）

1. Finder / 资源路径先查规范，再写模板。  
2. Grid 列表列宽一律 `minmax(0, …)`，内容节点 `min-width:0`。  
3. `listAsTree()` 的子分类 `postCount` 不可信，篇数要 `getByName`。  
4. 第三方服务与博客同为 HTTPS，或接受被拦。  
5. 改视觉前先出可点 HTML / 真站预览；静态设计稿看不出字号、字体兜底、hover。  
6. 公开仓库勿写入 Navidrome 默认 IP / 密码；`settings.yaml` 留空由后台配置。

---

## 7. 后续优化待办（交接时点）

已完成（2026-07-31 迭代）：书单页去掉强制书名号；补 `tag.html` / `tags.html`；书单墙 `getByName` 篇数；主题设置扩展（印章/格言/区块标题/显示开关）。

仍可继续：

1. **视觉精修**：在保留书卷气前提下优化间距、动效、阅读体验。  
2. **移动端**：再验书单墙、文章侧栏、播放器触控。  
3. **可选**：独立页面模板 `page.html`、友情链接等。  
4. **运维**：CORS 若从 `*` 收紧，只改 Navidrome 环境变量。

---

## 8. 仓库与站外部署对照

| 项 | 说明 |
|---|---|
| 本仓库 | `C:\Users\LXP\Projects\halo-Time_Capsule` · GitHub `jason9356/halo-Time_Capsule` |
| 线上主题名 | `time-capsule`（`theme.yaml` metadata.name） |
| 原始交接长文 | 桌面《时间容器-主题设计到部署全记录》《CORS排查记录》（本文已吸收可用部分；密钥路径未收录） |

---

*持续优化时：保设计系统与书/分类信息架构，优先清 §7 待办，再做观感迭代。*
