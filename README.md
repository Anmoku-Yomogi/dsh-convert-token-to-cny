# dsh-convert-token-to-cny

> 把 DeepSeek Harness 对话里消耗的 Token 直接折算成人民币，显示在输入框下方的信息栏里。

DSH 的底部信息栏本来就会显示 Token 总量和缓存命中率，但「这段对话到底花了多少钱」还得自己心算。这个插件在**完全保留原有信息**的前提下，追加一枚 `≈￥0.0123` 的小胶囊，悬停即可看到完整拆分。

![输入框下方的信息栏：内置运行统计、Token 用量与缓存命中率之后，是本插件追加的 ≈￥0.926 花费胶囊](docs/info-bar.png)

*从左到右：运行统计、Token 用量与缓存命中率（均为 DSH 内置信息），以及本插件追加的人民币花费胶囊。*

## 功能

- **只增不改**：作为独立条目挂在 `conversation.composer.dock`，内置的运行统计与 Token 用量保持原样。
- **整段对话**：数据来自持久化会话投影，分页、压缩之前的 Token 也算在内，不是「屏幕上能看到的消息」。
- **自动识别模型**：读取会话的 `modelSelection` 投影，内置 `deepseek-flash` 与 `deepseek-v4-pro` 两套价目。
- **峰谷自动切换**：按北京时间区分峰时/谷时，周末与法定节假日全天谷时。
- **跟随外观**：使用 DSH 主题变量，浅色/深色、字号、中英文界面自动适配。
- **纯本地**：不联网、不读文件、不写 Host，所有计算都在浏览器里完成。

## 安装

插件是标准的 DSH bundle，包名为 `@local/dsh-token-cost`，仓库名 `dsh-convert-token-to-cny`。

### 方式一：通过 DSH 插件管理器（推荐）

把仓库克隆到任意目录，例如 `D:\plugins\dsh-convert-token-to-cny`，然后让 DSH 的智能体执行：

```text
plugin_manager install_bundle  target = D:/plugins/dsh-convert-token-to-cny
```

插件管理器会完成 profile 依赖写入、bundle 挂载与生效，不需要构建步骤。

### 方式二：手动 link

1. 打开 profile 目录（桌面端默认 `%USERPROFILE%\.dsh\profiles\desktop`）；
2. 在 `package.json` 的 `dependencies` 中加入：

   ```jsonc
   "@local/dsh-token-cost": "link:D:/plugins/dsh-convert-token-to-cny"
   ```

3. 在 `dsh.profile.bundles` 末尾追加 `"@local/dsh-token-cost"`；
4. 在该目录执行 `pnpm install`；
5. 重启 DSH（客户端 bundle 需要重新加载）。

安装后无需任何配置，打开任意有 Token 用量的对话即可看到。

## 显示什么

| 项目 | 说明 |
| --- | --- |
| 位置 | `conversation.composer.dock`，`order: 2` —— 紧跟内置的 `activity`(0)、`usage`(1) 之后 |
| 形态 | 左图标右数值，图标 14×14、`gap: 6px`、`padding: 1px 8px`，与内置胶囊同尺寸同字号 |
| 数值 | `≈￥0.0123`；小于 0.01 元显示 4 位小数，小于 1 元 3 位，小于 100 元 2 位，更大 1 位 |
| 悬停 | 估算总额、三类 Token 数量、当前单价、峰/谷时段、所用模型价格表 |
| 隐藏 | 尚未产生任何用量数据时自动不渲染，不会留下空位 |

## 计价规则

价格取自 [DeepSeek 官方价目](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)（人民币 / 百万 tokens，2026-11）：

| 模型 | 缓存命中（谷 / 峰） | 缓存未命中（谷 / 峰） | 输出（谷 / 峰） |
| --- | --- | --- | --- |
| `deepseek-flash` | 0.02 / 0.04 | 1 / 2 | 4 / 8 |
| `deepseek-v4-pro` | 0.15 / 0.30 | 4.5 / 9 | 13.5 / 27 |

- **峰时**：北京时间周一至周五 `09:00–12:00`、`14:00–18:00`，不含中国法定节假日；
- **谷时**：其余所有时间（含周末与节假日全天），价格为峰时的一半；
- **缓存写入**按「缓存未命中输入」单价计费；
- 会话没有上报模型时，回退到 `deepseek-flash` 价目。

单次折算公式：

```text
费用 = (未命中输入 + 缓存写入) × 未命中单价
     + 缓存读取 × 命中单价
     + 输出 × 输出单价
```

### 为什么是「估算」

`tokenUsage` 投影只保留整段对话的**分类 Token 总量**，没有逐次请求的时间戳，所以插件无法把历史请求逐条拆到不同峰谷时段。它按**当前时段**的单价统一折算：单时段对话基本准确，跨 09:00 / 12:00 / 14:00 / 18:00 的长对话会有一点偏差。

另外，插件只统计模型调用的 Token 费用，网页搜索、抓取等按次计费的项目不在其中。

## 自定义

所有可调项都在 [`client.js`](client.js) 顶部。改完重启 DSH 生效（本地 link 安装时刷新页面即可）。

```js
// 人民币 / 百万 tokens，[谷时, 峰时]
const PRICES = {
  'deepseek-flash': {
    cacheRead: [0.02, 0.04],
    cacheMiss: [1, 2],
    output: [4, 8],
  },
  'deepseek-v4-pro': {
    cacheRead: [0.15, 0.3],
    cacheMiss: [4.5, 9],
    output: [13.5, 27],
  },
};

// 会话没有上报模型时使用的价格表
const FALLBACK_MODEL = 'deepseek-flash';

// 中国法定节假日（含首尾），用于峰谷判断
const HOLIDAYS = [
  ['2026-10-01', '2026-10-07'],
  // …
];
```

- 想支持新的模型：按 `modelSelection` 上报的模型 id 加一行即可，未命中时自动回退。
- 官方调价后：更新对应数组，并把 README 的表格一起改掉。
- 节假日表需要每年按国务院通知补充。

## 工作原理

1. 通过槽位标准属性 `useProjection('tokenUsage')` 读取整段对话的四类 Token：未命中输入、缓存读取、缓存写入、输出；
2. 通过 `useProjection('modelSelection')` 取最近一次请求实际使用的 provider/model；
3. 用当前北京时间判断峰谷，选单价，计算金额并格式化；
4. 北京时间每 30 秒复查一次峰谷（只在切换时触发重渲染），Token 变化则随投影订阅自动刷新。

整个过程只读取投影，不扫描事件、不轮询接口。

## 兼容性与限制

- 基于 DSH `0.2.1-rc.5` 桌面端 Web GUI 开发；`platform` 声明为 `web`。
- 依赖 DSH 提供的 `tokenUsage` / `modelSelection` 会话投影；缺少任一能力时会自动隐藏，不会报错。
- 价格表是内置常量，不随官方调价自动更新。
- 只对 DeepSeek 官方人民币价目有意义；其它 provider 会回退到 `deepseek-flash` 价格，金额仅供参照。

## 目录结构

```text
dsh-convert-token-to-cny/
├─ package.json       # bundle 清单：dsh.bundle.patch + dsh.client
├─ cordis.patch.yml   # 以 insert 方式挂载 id=token-cost 的插件行
├─ index.js           # Host 半边：空实现（纯客户端装饰）
├─ client.js          # 客户端半边：槽位注册、投影读取、峰谷与计价
├─ locale/
│  ├─ en.json         # 插件管理页的英文标题与描述
│  └─ zh.json         # 中文标题与描述
├─ icon.svg           # 插件图标（原创）
├─ docs/
│  └─ info-bar.png    # README 截图：信息栏里的花费胶囊
└─ README.md
```

## 卸载

- 用插件管理器：`plugin_manager remove_bundle target = @local/dsh-token-cost`；
- 手动安装：从 profile 的 `dependencies` 与 `dsh.profile.bundles` 中删掉对应条目，执行 `pnpm install` 后重启。

## FAQ

**为什么信息栏里没有出现？** 当前对话还没有产生任何 Token 用量，或页面未加载到新版客户端 bundle。先发一条消息，再刷新页面。

**为什么和账单有出入？** 这是按 Token 总量与当前时段单价做的估算，不含按次计费的搜索/抓取，也不处理跨时段的历史请求。以官方账单为准。

**会上传我的对话数据吗？** 不会。插件只读取本地会话的 Token 计数与模型名，所有计算都在浏览器内完成。

## License

[MIT](LICENSE)
