# 离线「同义/等价判定」调研（semantic review POC）

## 要解决的问题

默写/填空的答案目前是**严格相等**判定（见 `lib/utils.ts` 的 `checkBlanks`）：

```js
correct = typed.length > 0 && normalizeWord(typed) === normalizeWord(expected)
```

学生写 `bike` 而答案是 `bicycle` 时会被判错，即使语义完全相同。目标是找一个**纯本地、离线、不依赖外部 API** 的模型来做「这个学生的词能不能替换目标词」的判定。

## 结论（27 条人工标注测评集）

| 路线 | 方案 | 最佳准确率 | FP（过度接受） | FN（过严） | 速度 | 体积 |
|---|---|---|---|---|---|---|
| A1 | MiniLM 裸词向量 cosine | 77.8% | 0 | 7 | 极快 | ~80MB |
| A2 | MiniLM 整句语境 cosine | 77.8% | 8 | 0 | 极快 | ~80MB |
| B | Qwen3-0.6B 判官 (YES/NO) | 66.7% | 6 | 3 | ~900ms/题 | ~400MB |
| **C1** | **NLI 蕴含概率 P(entail)** | **92.6%** | **2** | **0** | **~5ms/题** | **~87MB** |
| C2 | NLI P(entail)−P(contra) | 92.6% | 2 | 0 | ~5ms/题 | ~87MB |

**推荐路线 C：NLI cross-encoder（`Xenova/nli-deberta-v3-xsmall`，Apache-2.0）。**
准确率最高（92.6%）、速度最快（5ms/题）、模型最小（量化后 ~87MB），且全部在本地 CPU 上跑。

### 为什么不是另外两条

- **句向量（MiniLM）**：短词之间的 cosine 不可靠。裸词能勉强分开（77.8%），但凡是带语境就严重过度接受——研究（MDPI 2025、'Similarity Gates Approve Reversals' 2026）也指出余弦相似度会给语义反转（`big→small` 0.875、`closed→open` 0.885）打高分。**只适合当廉价的预筛**，不能独立做决定。
- **更大的 NLI（`-small`, 172MB）没必要**：最佳准确率同样是 92.6%，但阈值必须推到 0.96 才达到，反而多出 1 个 FP（`film→bad` 0.944 在 C2 里）。体积翻倍、收益为零。用 `-xsmall` 即可。
- **小 LLM 判官（Qwen3-0.6B）**：有强烈的 YES 倾向。即使给了明确 system prompt + 平衡的 few-shot、且 `bicycle→car` 在示例里被标为 NO，模型仍对 `bicycle→car` 回 YES。修正 prompt 格式后从 48.1% 提到 66.7%，仍远不如 NLI。0.6B 规模不足以稳定做这种细粒度判定。

### NLI 的残留问题（2 个 FP）

- `their → there`（0.994）
- `affect → effect`（0.996）

这两组是**同音/拼写混淆**，不是同义词。替换后 `I like there house` 虽不合法，但 NLI 只做语义蕴含、不看语法，于是照收。**建议在 NLI 之前加一层拼写/词表过滤**（把 `there/their`、`affect/effect` 这类同音异形词直接判错），或对超短词的替换要求 NLI 分数更高（如 0.99+）。

## ⚠️ NLI 的致命盲区：它看不懂拼写

NLI 只判断「语义是否蕴含」，**没有任何词形/语法概念**。学生把目标词拼错时，
句子其余部分完全没变 → 整句几乎等价 → 蕴含分照样很高，于是拼写错误被判对。

实测（`typo-probe.mjs`），同一个拼写错误 `wonderful → wondefull`：

| 句子长度 | entail | entail≥0.9 判定 |
|---|---|---|
| 4 词 | 0.789 | 拒绝 |
| 6 词 | 0.876 | 拒绝 |
| 10 词 | 0.869 | 拒绝 |
| **18 词** | **0.927** | **✅ 接受（错判）** |

**句子越长越容易放过拼写错误。** 6 个真实 typo 里 5 个被误判为正确。

### 解法：拼写闸门（不需要词典）

关键观察 —— 拼写错误和真同义词在「写得多像」上区分度极高：

```
typo     wondefull/wonderful = 2      famliy/family = 1（字母转置）
真同义   cab/taxi = 3   store/shop = 3   bike/bicycle = 4
```

所以 `lib/utils.ts` 的 `looksLikeTypo()`：**Damerau–Levenshtein 距离 ≤2 且相对距离 ≤1/3
⇒ 判为拼写错误**，直接算错，不进 NLI。含字母转置（`famliy`、`bicycel`），零成本、确定性。

判定链（`lib/semanticJudge.ts`）：

```
① looksLikeTypo  → 拼写错误，判错（不进模型）
② CONFUSABLE     → 同音/形近易混词，判错（their/there, affect/effect…）
③ sameLemma      → 词形错误，判错（不进模型）  ← 见下一节
④ NLI            → entail ≥ 0.95（短词 ≥0.98）且 contra < 0.1 → 接受为近义替换
```

阈值从 0.9 抬到 0.95 的原因：真实句子 `What a wonderful family.` 里
`wondefull` 拿到了 **0.907**，刚好越过旧的 0.9。

## ⚠️ NLI 的第二个盲区：它也看不懂词形

补完拼写闸门后又发现一类漏网：**同一个词的不同变形**。实测 8 例，
**7 例 entail ≥ 0.95**，光调阈值救不回来：

| 词形错误 | entail | 编辑距离 |
|---|---|---|
| `sheep → sheeps` | 0.9929 | 1 |
| `go → goes` | 0.9947 | 2 |
| `mice → mouse` | 0.9879 | 3 |
| `tall → taller` | 0.9896 | 2 |
| `singer → singing` | 0.9849 | 3 |
| `informations → information` | 0.9665 | 1 |
| `animals → animate` | 0.965 | 3 |

（探针：`form-probe.mjs`）

**编辑距离在这里失效**：词形错误距离 1~3，而真同义词 `taxi/cab`、`shop/store`、
`child/kid` 距离同样是 3 —— 分不开。拼写闸门因此拦不住它们。

### 解法：词根还原（`sameLemma`，同样不需要词典）

可靠的区分点是**词位（lemma）**：

```
真同义词 = 两个不同的词      taxi ≠ cab
词形错误 = 同一个词的变形    sheep ↔ sheeps
```

`lib/utils.ts` 的 `sameLemma()` 把两边各自规则化还原到词根（`-s/-es/-ed/-ing/-er/-est/-ly/-ies…`
+ 一张不规则变形表 `men→man`、`goes→go`、`better→good`），若存在一对词根可通过
**删词尾**互相到达（`reductionDistance ≤ 1`，且不允许塞进额外字母）即判为同词不同形 ⇒ 词形错误。

因为标准答案永远来自原文，「同词不同形」必然就是学生变形错了。
长度差限制（≤3）用来避免 `animate`/`animal` 这种碰巧共享词尾片段的误判。

UI 上词形错误显示紫色「词形错误」标签，和琥珀色「拼写错误」、红色「用词错误」三者区分；
`hooks/usePractice.tsx` 也不会把它送去问模型（省一次推理）。

> 试过更大的 `nli-deberta-v3-xlarge` 想靠模型本身解决：它的 tokenizer 在
> transformers.js 里未实现（`tokenizer_class` 未注册），此路不通。

### 回归测评

`eval-rule.mjs` 复刻完整生产链，**43/43 = 100%**：

| 分组 | 数量 |
|---|---|
| 同义词（应判对） | 15/15 |
| 语义不等价（应判错） | 12/12 |
| 拼写错误（应判错） | 8/8 |
| 词形错误（应判错） | 8/8 |

注意它内部复制了一份 `editDistance`/`looksLikeTypo`/`spellingVariant`/`sameLemma`
（.mjs 无法直接 import TS），**改 lib/utils.ts 时要同步**。

## 已实施的集成

判定流程按「廉价→昂贵」分层：

1. **精确匹配**：`normalizeWord(typed) === normalizeWord(expected)` → 直接对（覆盖 99% 的正常作答）。
2. **拼写变体**：US/UK（`colour/color`、`-ise/-ize`）用规则归一 → 对。
3. **拼写闸门** `looksLikeTypo`（Damerau–Levenshtein ≤2 且相对距离 ≤1/3）→ 拼写错误，判错。
4. **词形闸门** `sameLemma`（同词不同形 sheep/sheeps）→ 词形错误，判错。
5. **NLI 判定**（仅在上面都没命中时）：`premise = 原句`，`hypothesis = 把原词替换成学生答案后的句子`，`P(entail) ≥ 0.95`（短词 ≥0.98）且 `P(contra) < 0.1` → 判为「接受的近义替换」。
4. 结果按 `(sentence_id, blank_order, typed)` 缓存进 SQLite，避免重复推理。

UI 上区分 **「正确」** 与 **「可接受的替换」**（后者柔和高亮，并可显示标准答案），不要让学生以为近义替换和标准答案完全等价。

### Next.js 落地方式

- `@huggingface/transformers`（本项目已装 `4.3.2`）可在 Node 侧用 `onnxruntime-node` 跑，模型首次自动下载后缓存在 `node_modules/@huggingface/transformers/.cache`。
- 放一个 API route（`app/api/judge/route.ts`，`runtime='nodejs'`），在前端判分后对「不精确匹配」的空做一次请求；模型实例在模块级只加载一次。
- 国内网络设 `env.remoteHost = 'https://hf-mirror.com'`（huggingface.co 在本机被墙）。

## 文件

| 文件 | 说明 |
|---|---|
| `pairs.mjs` | 27 条人工标注测评集（15 正例 / 12 反例），字段 `{sentence, zh, expected, typed, label}` |
| `poc.mjs` | 对比脚本，三条路线 A/B/C |
| `eval-rule.mjs` | **回归测评**：复刻完整生产链，43 条用例 |
| `typo-probe.mjs` | 探针：NLI 为什么放过拼写错误 |
| `form-probe.mjs` | 探针：NLI 为什么放过词形错误 |
| `probe.mjs` | 排查 Qwen3 聊天模板 / think 块 / generated_text 结构的探针 |

## 运行

```bash
# 全部
node tools/semantic-review/poc.mjs --model=all

# 单条路线
node tools/semantic-review/poc.mjs --model=minilm
node tools/semantic-review/poc.mjs --model=qwen
node tools/semantic-review/poc.mjs --model=nli                 # 默认 xsmall
node tools/semantic-review/poc.mjs --model=nli --nli-model=small

# 自定义阈值（默认 0.8）
node tools/semantic-review/poc.mjs --model=nli --threshold=0.9

# 换镜像
HF_ENDPOINT=https://huggingface.co node tools/semantic-review/poc.mjs --model=nli
```

## 测评集覆盖的同义关系

- 常见同义词：bicycle/bike, car/automobile, child/kid, begin/start, big/large, purchase/buy, film/movie, taxi/cab, shop/store, happy/glad, clever/smart, difficult/hard, repair/fix
- 英美拼写：colour/color, apartment/flat
- 反例：词义不同或相反（bicycle→car, big→small, happy→sad, closed→open…）、同音混淆（their/there, affect/effect）
