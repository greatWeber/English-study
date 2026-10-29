# 英语默写练习 · Dictation Trainer

一个零依赖的英语默写网站：按 **等级（CEFR A1–C2）** 和 **场景（日常 / 旅行 / 餐饮…）** 抽题，
可以练 **填空**，也可以练 **整句默写**。键盘直接打字，字母落在对应的格子里；回车判分，
写错的地方标红、漏写的地方显示虚线框；点「显示答案」下方给出正确句子 + 中文翻译。

```
English-study/
├── index.html                  # 唯一页面（双击就能用，无需构建、无需服务器）
├── data/
│   ├── sentences.js            # 内置精选语料（126 题，人工整理，含中文翻译与指定挖空）
│   ├── taxonomy.json           # 等级 / 场景定义（构建脚本共用）
│   └── sentences.tatoeba.js    # 可选：由脚本生成的大语料库（默认不存在）
├── assets/
│   ├── css/style.css           # 全部样式（浅色 / 深色自适应，响应式）
│   └── js/
│       ├── engine.js           # 纯逻辑：拆句、挖空、逐字判分（无 DOM 依赖）
│       └── app.js              # 界面与交互
├── scripts/build-dataset.mjs   # 用 Tatoeba + CEFR-J 生成上千条题目
└── tests/engine.test.mjs       # 判分逻辑自测（node tests/engine.test.mjs）
```

## 快速开始

```bash
# 方式一：直接打开
open index.html            # macOS；也可以直接双击 index.html

# 方式二：起个本地服务（推荐，行为与线上一致）
python3 -m http.server 8000
# 然后浏览器访问 http://localhost:8000
```

> 页面是纯静态的：`file://` 直接打开也没问题（数据用 `<script>` 引入，不走 fetch，所以没有跨域限制）。

## 用法与快捷键

| 操作 | 说明 |
| --- | --- |
| 直接打字 | 字母填进当前空格；一个词写满会自动跳到下一个空 |
| `Space` / `Tab` | 跳到下一个空（`Shift+Tab` 上一个空） |
| `←` `→` | 在当前词内移动；到边界会跨词 |
| `Backspace` | 删除光标前的字母；在词首会回到上一个词 |
| `Esc` | 清空当前空（已判分时则重做本题） |
| `Enter` | 检查答案；全对后再按一次进入下一题 |
| `⌘/Ctrl + Enter` | 显示答案（正确句子 + 中文翻译） |
| `⌘/Ctrl + H` | 首字母提示开关 |
| 点格子 | 光标跳到那个格子 |

判分规则（`engine.js`）：

- **大小写、前后空格不敏感**：`Station` / ` station ` 都算对。
- 写错 → 该字母标红并显示你写的字母；漏写 → 红色虚线框；多写 → 灰显划掉。
- 长度不同的词用 LCS 对齐，只标出真正写错的部分，不会整词全红。
- 默认「答对自动下一题」+「错题重练」（答错的题会在本轮末尾再出现一次），可在设置区关掉。
- 统计（累计题数 / 一次答对率 / 最长连对）存在 `localStorage`，键名 `eng-study/v1`。
- 还有「🔊 朗读整句」（浏览器 `speechSynthesis`，离线可用）和「只练错题」。

## 语料来源调研（重点）

你要的「有没有开源题目」——**有，而且质量不错**。下面是我核实过的可用资源，按推荐度排序：

| # | 资源 | 内容 | 许可 | 备注 |
| --- | --- | --- | --- | --- |
| 1 | [**Tatoeba**](https://tatoeba.org/en/downloads) | 数百万条多语例句，含**英↔中句对**，另有 85 万条**英语带音频**的句子 | 句子多为 **CC BY 2.0 FR**；导出里有专门的 **CC0 子集** | 本站 `scripts/build-dataset.mjs` 用的就是它。`downloads.tatoeba.org` 可直接下载 TSV |
| 2 | [**CEFR-J Vocabulary Profile v1.5**](https://github.com/openlanguageprofiles/olp-en-cefrj) | 7,799 个词条 → CEFR-J 等级（A1–B2） | 免费用于研究 / 商业用途，**需引用**（版权属 TUFS 的 Tono Lab） | 给单词定级的事实标准之一，比"按长度猜"靠谱 |
| 3 | [**Octanove Vocabulary Profile C1/C2**](https://github.com/openlanguageprofiles/olp-en-cefrj) | 2,137 个 C1/C2 词条 | **CC BY-SA 4.0** | 补上 CEFR-J 缺的高阶两档 |
| 4 | [**Words-CEFR-Dataset**](https://github.com/Maximax67/Words-CEFR-Dataset) | 单词/词性 → CEFR 等级（CSV + SQLite） | **MIT** | 想自己实现"句子定级"很方便；同作者的 [`cefrpy`](https://github.com/Maximax67/cefrpy)（MIT）直接给 Python 库 |
| 5 | [**CeFR-SP**](https://aclanthology.org/2022.emnlp-main.416/) (Arase et al., EMNLP 2022) | **17,000 条句级** CEFR 标注英语句子 | CC BY-NC-SA 4.0（非商用） | 是少数"句子级"标注集；收录于 [UniversalCEFR](https://universalcefr.github.io/) 索引 |
| 6 | [**UniversalCEFR**](https://universalcefr.github.io/) | 多语种 CEFR 语料索引，含 EFCAMDAT（40 万条学习者作文句）、BEAST2019 | 逐集不同（EFCAMDAT 需向 Cambridge 申请） | 想研究"学习者语料 / 易错点"看这里 |
| 7 | [**manythings.org 双语对照**](https://www.manythings.org/bilingual/) | 基于 Tatoeba 的英↔中句对网页（可爬） | 继承 Tatoeba 许可 | 适合快速抓几百条，不如直接下 TSV 干净 |
| 8 | [**CEFR-J Grammar Profile**](https://github.com/openlanguageprofiles/olp-en-cefrj) | 语法点 → CEFR 等级（部分翻译自日文） | 同上（需引用） | 想做"语法填空"专项时有用 |

几点实践结论：

1. **现成的"英语默写题库"几乎没有**——大家通常的做法就是拿 Tatoeba 这种**句子库**自己切题（这也是本项目的做法）。
2. **等级标注**要用词表反推。本项目 `build-dataset.mjs` 的思路：取句子里最难的实词等级 + 长度/生词比例做微调，够用但不精确；要更准就上 CeFR-SP 的标注数据。
3. **中文翻译**：Tatoeba 的 `cmn` 导出混了繁体，脚本里已做简体过滤（丢弃含繁体专用字的句子）。
4. **商用注意**：`engine.js` / 内置 126 题 / 代码是 MIT；Tatoeba 语料是 CC BY（需署名，页面已标注来源）；CeFR-SP、Octanove、EFCAMDAT 各有约束，混用时逐个看清许可。

## 扩充题量

```bash
# 生成约 3000 条（首次会下载 ~180MB，缓存在 scripts/.cache/，之后不再重复下）
node scripts/build-dataset.mjs

# 生成更多 / 只在小范围试跑
node scripts/build-dataset.mjs --limit=8000
node scripts/build-dataset.mjs --min-words=5 --max-words=12 --limit=200
```

跑完会生成 `data/sentences.tatoeba.js`，**刷新页面后顶部会出现「语料库」下拉框**，
在内置精选语料与 Tatoeba 语料之间切换。

脚本做的事：下载并流式解压 Tatoeba 导出 → 过滤（ASCII、4–14 词、16–82 字符、
去掉人名句）→ 用 CEFR-J / Octanove 词表估等级 → 关键词匹配场景 → 按等级均匀取样 → 写成 JS。

> 网络小提示：`raw.githubusercontent.com` 可能被重置，脚本里的词表走 `api.github.com` 拉取，所以在国内网络下也能跑。

## 已知限制 / 下一步

- 等级是**启发式估计**，不是权威标注；想要精确等级请接入 CeFR-SP。
- 场景靠关键词匹配，会有个别错分（比如含 "buy" 的句子会被归到购物）。
- 中文翻译来自 Tatoeba，可能不与英文一一对应得很地道。
- 还没做的：听写模式（隐藏句子只播音）、按词表/语法点专项练习、艾宾浩斯复习曲线、导出错题本。
- 朗读依赖系统语音包；Safari 首次使用需要用户手势触发。

## 许可

- 本项目代码与 `data/sentences.js` 内置语料：MIT。
- 通过脚本生成的 Tatoeba 语料：遵循 Tatoeba 的 CC BY 2.0 FR / CC0 许可，使用时请保留署名（生成的 JS 文件头部已写明来源）。
- CEFR-J / Octanove 词表：分别遵循「需引用」与 CC BY-SA 4.0。
