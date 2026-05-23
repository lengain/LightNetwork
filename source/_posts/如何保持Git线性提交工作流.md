---
title: 如何保持Git线性提交工作流
date: 2026-05-23 21:41:30
tags: 技术
categories: 技术
---

有时候过多的分支的提交记录会导致整个git历史杂乱而难以进行版本回溯，这里介绍一种基于 rebase 的 Git 工作流，核心目标是维护一条**线性、洁净的提交历史**，避免产生多余的 merge commit，让代码审查和版本回溯更加清晰。

## 核心原则

- 每条 feature 分支只包含该功能的必要提交
- 合入主干前通过 `rebase` 将分支提交平移到主干顶端
- 不使用 `merge --no-ff`，禁止产生环状历史
- 主干（`dev`）始终是一条直线

## 步骤详解

### 1. 同步本地主干

```bash
git checkout dev
git pull
```

确保本地 `dev` 分支与远程保持一致。`git pull` 相当于 `git fetch origin dev:dev` + 快进合并，在未偏离远程的前提下不会产生额外提交。

### 2. 创建功能分支

```bash
git checkout -b feature/my-feature dev
```

从 `dev` 最新位置切出功能分支。分支名建议使用 `feature/`、`fix/`、`chore/` 等前缀，便于 CI 和代码审查工具识别。

### 3. 在功能分支上开发

在功能分支上进行常规开发，按需提交：

```bash
git add <files>
git commit -m "feat: 添加用户登录功能"
```

建议遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范编写提交信息。

### 4. 变基到主干（关键步骤）

开发完成后（或在开发过程中需要同步主干更新时），执行变基：

```bash
git checkout dev
git pull              # 再次拉取最新 dev

git checkout feature/my-feature                      # 4.2 切回
#核心操作，在功能分支feature/my-feature上执行
git rebase dev        # 将当前分支的提交重新应用到 dev 顶端
```

#### 变基的原理

```
变基前：
dev:     A---B---C
              \
feature:       D---E

变基后：
dev:     A---B---C
                   \
feature:           D'---E'
```

`git rebase dev` 会在 `dev` 的最新位置（C）上，将当前分支的每个提交（D、E）逐个重放为新提交（D'、E'）。每个重放后的提交的 hash 会改变，但内容保持不变。在此过程中可能遇到冲突——每个提交重放时都会暂停，让你手动解决冲突后执行 `git add` 和 `git rebase --continue`。

在SourceTree中，选中 `feature/my-feature`，右键打开菜单，选择`将当前变更变基到dev`，此操作和`git rebase dev`一致。执行过变基后，SourceTree上会菜单区域的拉取和推送会显示多个数字，使用强制推送可消除，详细可查看第5步。

#### 变基过程中的冲突处理

```bash
# 变基过程中出现冲突时
git status                             # 查看冲突文件
# 手动解决冲突...
git add <resolved-files>
git rebase --continue                  # 继续应用下一个提交

# 如果某次重放发现该提交已无意义，可跳过
git rebase --skip

# 如果变基方向错了，立即中止
git rebase --abort
```

变基的核心价值在于：它让 feature 分支的历史看起来像是在主干最新代码之上从头开发的，消除了"我先切了分支，期间主干又合入了别人的代码"这类分叉信息。这些分叉细节在开发过程中有意义，但对最终代码审查没有价值，应当从历史中抹去。

### 5. 推送变基后的分支

```bash
git push --force-with-lease
```

**必须使用 `--force-with-lease`，禁止使用裸 `--force`**。

`--force-with-lease` 是一个安全机制：推送前它会检查远程分支的最新提交是否与你上次 fetch 时一致，如果远程有人在你不察觉时推送了新提交，推送会被拒绝，避免覆盖他人的工作。裸 `--force` 不做此检查。

如果你的分支是首次推送到远端，使用 `git push -u origin feature/my-feature` 建立跟踪关系，之后变基后再使用 `git push --force-with-lease`。

强制推送在SourceTree中，不是默认显示的，在`设置`-`高级`，选中`允许强制推送`后，SourceTree的推送窗口中才会显示`强制推送`。推送时，选中`强制推送`,效果和`git push --force-with-lease`一样。

#### 团队协作中的推送时机

变基会重写历史，多人协作时需格外小心：

- **单人使用的功能分支**：随时可以推，无风险
- **多人协作的功能分支**：变基前必须通知所有协作者完成本地提交并推送，变基后所有人执行 `git fetch && git reset --hard origin/feature/my-feature` 同步本地
- **已合入主干的提交**：**永远不要变基**，这是 Git 协作的底线

如果团队对同一个功能分支协作频繁，可以考虑改为使用普通 merge 或 squash merge，减少沟通成本。

### 6. 合入主干

```bash
git checkout dev
git merge feature/my-feature        # 此时只能是快进合并
```

由于已在步骤 4 中变基，`dev` 的头部正是 `feature/my-feature` 的基座，`merge` 操作只会执行一次快进（fast-forward），即直接把 `dev` 指针前移到 feature 分支的最新位置，**不会创建额外的 merge commit**。

```
dev:     A---B---C---D'---E'        ← 快进合并后, dev 直接指向 E'
feature: A---B---C---D'---E'        ← feature 与 dev 指向同一位置
```

如果系统配置了 `merge --no-ff`（例如 GitLab/GitHub 的合入门禁），需要使用以下方式执行合并：

```bash
git merge --ff-only feature/my-feature
```

如果上述命令失败，说明 dev 在此期间又有新提交，应回到步骤 4 重新变基。

### 7. 删除功能分支

```bash
git branch -d feature/my-feature          # 删除本地分支
git push origin --delete feature/my-feature  # 删除远程分支
```

本地分支使用 `-d`，Git 会检查该分支是否已完全合入；如果合入未完成会拒绝删除。如需强制删除才使用 `-D`。

远程分支的清理同样重要，残留的远程分支会在 `git branch -r` 和 CI 流水线中造成干扰。

## 完整流程（快捷版）

```bash
git checkout dev && git pull                         # 1. 同步
git checkout -b feature/my-feature dev               # 2. 创建分支

# ... 开发、提交 ...

git checkout dev && git pull                         # 4.1 再次同步
git checkout feature/my-feature                      # 4.2 切回
git rebase dev                                       # 4.3 变基
git push -u origin feature/my-feature --force-with-lease  # 5. 推送（首次自动设上游）
git checkout dev && git merge --ff-only feature/my-feature  # 6. 合入
git branch -d feature/my-feature                     # 7.1 删除本地
git push origin --delete feature/my-feature          # 7.2 删除远程
```

## 常见问题

### Q: 为什么不用 `git merge dev` 代替 `git rebase dev`？

两者的效果都能把主干更新同步到功能分支，区别在于最终的历史形态：

| 操作               | 历史形态                | 可读性       |
| ---------------- | ------------------- | --------- |
| `git merge dev`  | 产生分叉 + merge commit | 主干被淹没在分叉中 |
| `git rebase dev` | 线性延展                | 历史是一条直线   |

如果团队对历史可读性要求不高，或分支间协作者较多，merge 的开销更低。选择哪种方式取决于团队规模和审查习惯。

### Q: `--force-with-lease` 就一定安全吗？

不是绝对安全。如果远程分支被恶意或错误地推送了内容，而你的本地恰好是最新 fetch 的状态，`--force-with-lease` 不会阻止你覆盖这些内容。在多人高频协作的场景下，不应依赖 force push，而应改用 `git push --atomic` 或通过 PR/MR 机制合入。

### Q: 什么时候适合用 squash 代替 rebase？

当你认为功能分支上的多个小提交（"fix typo"、"WIP"、"add debug log"）不需要保留到主干历史中时，可以在变基时压缩：

```bash
git rebase -i dev    # 交互式变基
```

将次要提交标记为 `squash`，合并后保留一条清晰的提交记录。也可以直接在合并时使用 `git merge --squash feature/my-feature`，但这样会丢失分支的提交粒度。

## 推荐规范

- 每个功能分支应当只做一件事，保持职责单一
- 提交信息遵循 Conventional Commits 规范：`type(scope): description`
- 变基前先检查是否有未推送的提交：`git log origin/dev..HEAD`
- CI 检查通过后再合入主干
- 禁止向 dev 直接推送（使用 Merge Request / Pull Request）

## 参考

- [Pro Git - Rebasing](https://git-scm.com/book/zh/v2/Git-%E5%88%86%E6%94%AF-%E5%8F%98%E5%9F%BA)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git --force-with-lease](https://git-scm.com/docs/git-push#Documentation/git-push.txt---no-force-with-lease)
