# ☁️ 接入 Supabase —— 真实用户 · 云端数据库（约 5 分钟）

让网站拥有**真实用户体系**：访客注册/登录，测试结果保存到云端数据库，
不同设备上的真实用户可以互相匹配、聊天、逛社区。未配置时网站保持「本地模式」，
全部功能照常可用（双标签页模拟双人）。

## 第 1 步：创建 Supabase 项目（免费）

1. 打开 [supabase.com](https://supabase.com) → Sign up（可用 GitHub 账号直接登录）
2. New project → 起个名字（如 `wuxing-match`）→ 设置数据库密码（随便设，记不住没关系）→ 区域选 Singapore / Tokyo 较快
3. 等待约 1 分钟项目初始化完成

## 第 2 步：初始化数据库（复制粘贴即可）

1. 项目左侧菜单 → **SQL Editor** → New query
2. 打开本仓库的 [`matching/supabase-setup.sql`](matching/supabase-setup.sql)，**全选复制**进去 → **Run**
3. 显示 `Success` 即完成。这一步创建了：
   - 用户档案表 `profiles`（测试结果跨设备保存）
   - 匹配池 `pool`、匹配记录 `matches`、聊天 `messages`
   - 社区帖子 `posts` / 评论 `comments`
   - 服务端原子撮合函数 `try_match()`（与前端同一套五行生克算法）
   - 行级安全（RLS）与实时推送配置

## 第 3 步：关闭邮箱验证（演示推荐）

左侧 **Authentication → Sign In / Providers → Email**：
关闭 **Confirm email** 开关 → Save。
（否则注册后需要去邮箱点验证链接才能登录。正式上线想要更安全可以再打开。）

## 第 4 步：把密钥填进应用

1. 左侧 **Project Settings（⚙️）→ API**：
   - 复制 **Project URL**（形如 `https://xxxx.supabase.co`）
   - 复制 **anon public key**（一长串 `eyJ…`）
2. 打开你的网站 → 匹配池面板 → **「☁️ 接入云端，匹配真实用户」**
3. 粘贴两项 → **保存并连接** → 显示 ✓ 后**注册一个账号登录**

登录后：测试结果自动存入数据库（换设备登录同一账号即可恢复档案），
进入匹配池后就是**真实用户池**——其他设备的注册用户可以互相匹配、聊天、发帖。

## 常见问题

| 问题 | 处理 |
|------|------|
| 「连接失败」 | 检查 URL 是否带了 `/` 以外的路径；Key 必须是 **anon public**（不是 service_role） |
| 注册后登录提示需要验证 | 第 3 步没做，去关闭 Confirm email |
| 匹配不到人 | 在线模式匹配的是**真实注册用户**——用另一台设备/浏览器再注册一个号进池即可看到互相匹配 |
| 机器人有缘人 | 在线模式自动关闭（匹配真实用户）；本地模式仍可召唤演示 |
| 想清空数据 | Supabase → Table Editor 里清空对应表即可 |

## 架构说明

```
浏览器 A ─┐                                    ┌─ Realtime 推送（聊天/匹配/社区实时刷新）
浏览器 B ─┼── supabase-js ──► Postgres 数据库 ─┤
浏览器 C ─┘   （认证 + 查询）                   └─ try_match() 服务端原子撮合（每 4 秒被客户端轮询触发）
```

- **安全**：前端只持有 anon key，所有读写受行级安全（RLS）约束——用户只能改自己的档案、
  池状态和聊天；匹配撮合与结束聊天通过服务端函数（security definer）原子执行，防并发错乱。
- **费用**：Supabase 免费档足够个人项目使用（500MB 数据库 / 5 万月活用户 / 实时推送）。
