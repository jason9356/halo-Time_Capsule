# 书目半自动填写（本机运行，不必部署到服务器）

用 Google Books / Open Library 查封面、作者、简介，写回 Halo「阅读」下的书目分类。

## 怎么「部署」

**不用装到服务器。** 在你自己的电脑上跑即可（有 Python 3.10+）。

```
你的电脑
  └─ book_fill.py  ──(HTTPS)──►  Google Books / Open Library（查书）
                     ──(HTTPS)──►  blog.xybkwd.top Halo API（写分类）
```

主题只负责**展示**；这个脚本负责**半自动填数**。

## 一次性准备

1. 安装 Python 3（已有可跳过）：https://www.python.org/downloads/  
   安装时勾选 “Add python.exe to PATH”。
2. Halo 后台 → **个人中心 / 用户** → **个人令牌（PAT）** → 新建  
   权限至少能管理内容/分类（管理员令牌最省事）。
3. 复制环境文件并填入令牌：

```powershell
cd D:\project\halo-Time_Capsule\tools\book-fill
copy .env.example .env
notepad .env
```

`.env` 示例：

```
HALO_BASE_URL=https://blog.xybkwd.top
HALO_PAT=你的令牌
BOOK_ROOT_SLUG=yue-du
```

4. 主题需已上传含 `annotation-settings.yaml` 的版本，并在后台 **重载主题配置**。  
   分类编辑里会出现「书籍作者 / ISBN」字段。

## 日常用法

先在 Halo 建好书目子分类（只要书名），再在本机执行：

```powershell
cd D:\project\halo-Time_Capsule\tools\book-fill

# 交互：列出书目 → 用分类名去搜
python book_fill.py

# 指定 slug + ISBN（最准）
python book_fill.py --slug xi-han --isbn 9787530219218

# 指定 slug + 书名关键词
python book_fill.py --slug xi-han --query "稀罕 阿乙"

# 先预览不写回
python book_fill.py --slug xi-han --isbn 9787530219218 --dry-run

# 覆盖已有封面/简介/作者
python book_fill.py --slug xi-han --isbn 9787530219218 --overwrite
```

脚本会让你从候选结果里选一本，确认后再写回。

## 写到哪里

| 信息 | Halo 字段 |
|------|-----------|
| 封面 | 分类 `spec.cover`（外链图片 URL） |
| 简介 | 分类 `spec.description` |
| 作者 | 分类注解 `tc.xybkwd.top/book-author` |
| ISBN | 分类注解 `tc.xybkwd.top/book-isbn` |

封面目前是外链（Google/Open Library）。若以后图床失效，可在分类里改成自己上传的附件地址。

## 注意

- 中文书 ISBN 成功率更高；纯书名偶发对不上，换关键词或 ISBN。
- **不要**把 `.env` 提交到 Git（已忽略）。
- 令牌等同管理员密码，只放在本机。
