/*!
 * sentences.js — 内置精选语料（人工整理，等级 + 场景双维度）
 *
 * 字段说明
 *   id       唯一 id
 *   level    CEFR 等级 A1 / A2 / B1 / B2 / C1 / C2
 *   category 场景 id，见 data/categories
 *   text     英文句子
 *   zh       中文翻译（用作提示）
 *   blanks   （可选）指定要挖空的单词，留空则自动挑最长的实词
 *   source   语料来源标记
 *
 * 想换成上千条的语料库？跑 `node scripts/build-dataset.mjs`，
 * 会用 Tatoeba（CC0/CC-BY）+ CEFR-J 词表生成 data/sentences.tatoeba.js，
 * 页面会自动识别并出现在"语料库"下拉框里。
 */
window.APP_DATA = {
  version: 1,
  updated: '2026-10-28',
  name: '内置精选',
  license: 'MIT（本项目编写）',
  levels: [
    { id: 'A1', name: 'A1 · 入门', desc: '最基础的日常表达、短句' },
    { id: 'A2', name: 'A2 · 初级', desc: '常见场景的简单交流' },
    { id: 'B1', name: 'B1 · 中级', desc: '能描述经历与观点' },
    { id: 'B2', name: 'B2 · 中高级', desc: '抽象话题、地道搭配' },
    { id: 'C1', name: 'C1 · 高级', desc: '学术与职场进阶词汇' },
    { id: 'C2', name: 'C2 · 精通', desc: '低频词、修辞与书面语' }
  ],
  categories: [
    { id: 'daily', name: '日常生活', icon: '🏠' },
    { id: 'travel', name: '出行旅行', icon: '✈️' },
    { id: 'food', name: '餐饮美食', icon: '🍽️' },
    { id: 'shopping', name: '购物消费', icon: '🛍️' },
    { id: 'study', name: '校园学习', icon: '📚' },
    { id: 'work', name: '职场办公', icon: '💼' },
    { id: 'health', name: '健康医疗', icon: '🩺' },
    { id: 'social', name: '社交寒暄', icon: '💬' }
  ],
  sentences: [
    /* ---------------------------- A1 ---------------------------- */
    { id: 'a1-daily-1', level: 'A1', category: 'daily', text: 'I usually get up at seven in the morning.', zh: '我通常早上七点起床。', blanks: ['usually'] },
    { id: 'a1-daily-2', level: 'A1', category: 'daily', text: 'My brother is a teacher at a primary school.', zh: '我哥哥是一所小学的老师。', blanks: ['teacher'] },
    { id: 'a1-daily-3', level: 'A1', category: 'daily', text: 'We walk to the park after dinner.', zh: '晚饭后我们走路去公园。', blanks: ['walk'] },
    { id: 'a1-travel-1', level: 'A1', category: 'travel', text: 'The bus stops in front of the hotel.', zh: '公交车停在酒店前面。', blanks: ['hotel'] },
    { id: 'a1-travel-2', level: 'A1', category: 'travel', text: 'Where is the train station?', zh: '火车站在哪里？', blanks: ['station'] },
    { id: 'a1-travel-3', level: 'A1', category: 'travel', text: 'I want a ticket to London.', zh: '我想要一张去伦敦的票。', blanks: ['ticket'] },
    { id: 'a1-food-1', level: 'A1', category: 'food', text: 'I would like a cup of tea.', zh: '我想要一杯茶。', blanks: ['tea'] },
    { id: 'a1-food-2', level: 'A1', category: 'food', text: 'This cake tastes very sweet.', zh: '这个蛋糕尝起来很甜。', blanks: ['sweet'] },
    { id: 'a1-food-3', level: 'A1', category: 'food', text: 'We eat rice and fish for lunch.', zh: '我们午饭吃米饭和鱼。', blanks: ['lunch'] },
    { id: 'a1-shopping-1', level: 'A1', category: 'shopping', text: 'How much is this blue shirt?', zh: '这件蓝色衬衫多少钱？', blanks: ['shirt'] },
    { id: 'a1-shopping-2', level: 'A1', category: 'shopping', text: 'I need a new pair of shoes.', zh: '我需要一双新鞋。', blanks: ['shoes'] },
    { id: 'a1-shopping-3', level: 'A1', category: 'shopping', text: 'The shop opens at nine o\'clock.', zh: '这家店九点开门。', blanks: ['opens'] },
    { id: 'a1-study-1', level: 'A1', category: 'study', text: 'Please open your book to page ten.', zh: '请把书翻到第十页。', blanks: ['page'] },
    { id: 'a1-study-2', level: 'A1', category: 'study', text: 'My English class starts at eight.', zh: '我的英语课八点开始。', blanks: ['starts'] },
    { id: 'a1-study-3', level: 'A1', category: 'study', text: 'I do my homework every evening.', zh: '我每天晚上做作业。', blanks: ['homework'] },
    { id: 'a1-work-1', level: 'A1', category: 'work', text: 'She works in a small office.', zh: '她在一间小办公室工作。', blanks: ['office'] },
    { id: 'a1-work-2', level: 'A1', category: 'work', text: 'I start work at nine and finish at six.', zh: '我九点上班，六点下班。', blanks: ['finish'] },
    { id: 'a1-work-3', level: 'A1', category: 'work', text: 'My boss is very friendly.', zh: '我的老板很友好。', blanks: ['friendly'] },
    { id: 'a1-health-1', level: 'A1', category: 'health', text: 'I have a headache today.', zh: '我今天头疼。', blanks: ['headache'] },
    { id: 'a1-health-2', level: 'A1', category: 'health', text: 'You should drink more water.', zh: '你应该多喝水。', blanks: ['water'] },
    { id: 'a1-health-3', level: 'A1', category: 'health', text: 'The doctor is very kind.', zh: '这位医生很和善。', blanks: ['doctor'] },
    { id: 'a1-social-1', level: 'A1', category: 'social', text: 'Nice to meet you, my name is Lily.', zh: '很高兴认识你，我叫莉莉。', blanks: ['meet'] },
    { id: 'a1-social-2', level: 'A1', category: 'social', text: 'How was your weekend?', zh: '你周末过得怎么样？', blanks: ['weekend'] },
    { id: 'a1-social-3', level: 'A1', category: 'social', text: 'Thank you for your help.', zh: '谢谢你的帮助。', blanks: ['help'] },

    /* ---------------------------- A2 ---------------------------- */
    { id: 'a2-daily-1', level: 'A2', category: 'daily', text: 'I have been living in this city for three years.', zh: '我在这座城市住了三年。', blanks: ['living'] },
    { id: 'a2-daily-2', level: 'A2', category: 'daily', text: 'My neighbors are always ready to lend a hand.', zh: '我的邻居总是乐于帮忙。', blanks: ['lend'] },
    { id: 'a2-daily-3', level: 'A2', category: 'daily', text: 'It often rains here in early spring.', zh: '这里早春经常下雨。', blanks: ['spring'] },
    { id: 'a2-travel-1', level: 'A2', category: 'travel', text: 'We booked a hotel near the beach.', zh: '我们在海滩附近订了一家酒店。', blanks: ['booked'] },
    { id: 'a2-travel-2', level: 'A2', category: 'travel', text: 'Could you tell me how to get to the airport?', zh: '你能告诉我怎么去机场吗？', blanks: ['airport'] },
    { id: 'a2-travel-3', level: 'A2', category: 'travel', text: 'The flight was delayed because of the storm.', zh: '航班因暴风雨延误了。', blanks: ['delayed', 'storm'] },
    { id: 'a2-food-1', level: 'A2', category: 'food', text: 'Would you like anything else with your meal?', zh: '您的餐还需要别的吗？', blanks: ['anything'] },
    { id: 'a2-food-2', level: 'A2', category: 'food', text: 'I am trying to eat less sugar.', zh: '我在努力少吃糖。', blanks: ['sugar'] },
    { id: 'a2-food-3', level: 'A2', category: 'food', text: 'This restaurant is famous for its noodles.', zh: '这家餐厅以面条闻名。', blanks: ['famous', 'noodles'] },
    { id: 'a2-shopping-1', level: 'A2', category: 'shopping', text: 'I would like to return this jacket.', zh: '我想退掉这件夹克。', blanks: ['return'] },
    { id: 'a2-shopping-2', level: 'A2', category: 'shopping', text: 'These shoes are too tight for me.', zh: '这双鞋对我来说太紧了。', blanks: ['tight'] },
    { id: 'a2-shopping-3', level: 'A2', category: 'shopping', text: 'The store offers a discount on weekends.', zh: '这家店周末有折扣。', blanks: ['discount'] },
    { id: 'a2-study-1', level: 'A2', category: 'study', text: 'I need to hand in my essay by Friday.', zh: '我需要在周五前交论文。', blanks: ['essay'] },
    { id: 'a2-study-2', level: 'A2', category: 'study', text: 'Our teacher asked us to work in pairs.', zh: '老师让我们两人一组练习。', blanks: ['pairs'] },
    { id: 'a2-study-3', level: 'A2', category: 'study', text: 'Taking notes helps me remember new words.', zh: '记笔记帮助我记住新单词。', blanks: ['notes', 'remember'] },
    { id: 'a2-work-1', level: 'A2', category: 'work', text: 'I have a meeting with the client tomorrow.', zh: '我明天要和客户开会。', blanks: ['client'] },
    { id: 'a2-work-2', level: 'A2', category: 'work', text: 'Could you send me the report by email?', zh: '你能用邮件把报告发给我吗？', blanks: ['report'] },
    { id: 'a2-work-3', level: 'A2', category: 'work', text: 'She was promoted to manager last month.', zh: '她上个月被提升为经理。', blanks: ['promoted'] },
    { id: 'a2-health-1', level: 'A2', category: 'health', text: 'You should see a doctor if the pain continues.', zh: '如果疼痛持续，你应该去看医生。', blanks: ['pain', 'continues'] },
    { id: 'a2-health-2', level: 'A2', category: 'health', text: 'Getting enough sleep keeps you healthy.', zh: '充足的睡眠让你保持健康。', blanks: ['healthy'] },
    { id: 'a2-health-3', level: 'A2', category: 'health', text: 'I am allergic to peanuts.', zh: '我对花生过敏。', blanks: ['allergic'] },
    { id: 'a2-social-1', level: 'A2', category: 'social', text: 'I would love to join you for dinner.', zh: '我很想和你一起吃晚饭。', blanks: ['join'] },
    { id: 'a2-social-2', level: 'A2', category: 'social', text: 'Please give my regards to your parents.', zh: '请代我向你父母问好。', blanks: ['regards'] },
    { id: 'a2-social-3', level: 'A2', category: 'social', text: 'Sorry, I did not catch what you said.', zh: '抱歉，我没听清你说的话。', blanks: ['catch'] },

    /* ---------------------------- B1 ---------------------------- */
    { id: 'b1-daily-1', level: 'B1', category: 'daily', text: 'I usually try to finish my chores before noon.', zh: '我通常尽量在中午前做完家务。', blanks: ['chores'] },
    { id: 'b1-daily-2', level: 'B1', category: 'daily', text: 'Living alone taught me how to manage my time.', zh: '独居教会了我如何管理时间。', blanks: ['manage'] },
    { id: 'b1-daily-3', level: 'B1', category: 'daily', text: 'Our building has a small garden on the roof.', zh: '我们楼顶上有一个小花园。', blanks: ['garden', 'roof'] },
    { id: 'b1-travel-1', level: 'B1', category: 'travel', text: 'We decided to travel light and take only one bag.', zh: '我们决定轻装出行，只带一个包。', blanks: ['decided'] },
    { id: 'b1-travel-2', level: 'B1', category: 'travel', text: 'Make sure your passport does not expire this year.', zh: '确保你的护照今年不过期。', blanks: ['passport', 'expire'] },
    { id: 'b1-travel-3', level: 'B1', category: 'travel', text: 'The tour guide explained the history of the old town.', zh: '导游讲解了老城的历史。', blanks: ['explained'] },
    { id: 'b1-food-1', level: 'B1', category: 'food', text: 'I have cut down on coffee since last month.', zh: '从上个月起我减少了咖啡。', blanks: ['coffee'] },
    { id: 'b1-food-2', level: 'B1', category: 'food', text: 'The soup needs a little more salt.', zh: '这汤需要再加一点盐。', blanks: ['salt'] },
    { id: 'b1-food-3', level: 'B1', category: 'food', text: 'Vegetables lose their vitamins when overcooked.', zh: '蔬菜煮过头会损失维生素。', blanks: ['vitamins'] },
    { id: 'b1-shopping-1', level: 'B1', category: 'shopping', text: 'I ended up buying a coat that was on sale.', zh: '我最后买了一件打折的外套。', blanks: ['sale'] },
    { id: 'b1-shopping-2', level: 'B1', category: 'shopping', text: 'Could I get a refund instead of a replacement?', zh: '我可以退款而不是换货吗？', blanks: ['refund', 'replacement'] },
    { id: 'b1-shopping-3', level: 'B1', category: 'shopping', text: 'Comparing prices online saves me a lot of money.', zh: '在网上比价帮我省了很多钱。', blanks: ['Comparing'] },
    { id: 'b1-study-1', level: 'B1', category: 'study', text: 'Reading widely is the best way to build vocabulary.', zh: '广泛阅读是积累词汇的最好方法。', blanks: ['vocabulary'] },
    { id: 'b1-study-2', level: 'B1', category: 'study', text: 'I failed the first attempt but passed the second.', zh: '我第一次没通过，但第二次过了。', blanks: ['attempt'] },
    { id: 'b1-study-3', level: 'B1', category: 'study', text: 'The lecture was difficult, so I recorded it.', zh: '讲座很难，所以我录了下来。', blanks: ['lecture', 'recorded'] },
    { id: 'b1-work-1', level: 'B1', category: 'work', text: 'We need to meet the deadline without sacrificing quality.', zh: '我们需要在不牺牲质量的前提下赶上截止日期。', blanks: ['deadline', 'quality'] },
    { id: 'b1-work-2', level: 'B1', category: 'work', text: 'He handled the complaint in a professional manner.', zh: '他以专业的方式处理了投诉。', blanks: ['complaint'] },
    { id: 'b1-work-3', level: 'B1', category: 'work', text: 'I am responsible for training the new staff.', zh: '我负责培训新员工。', blanks: ['responsible', 'training'] },
    { id: 'b1-health-1', level: 'B1', category: 'health', text: 'Regular exercise reduces the risk of heart disease.', zh: '规律运动降低患心脏病的风险。', blanks: ['exercise', 'disease'] },
    { id: 'b1-health-2', level: 'B1', category: 'health', text: 'He recovered from the flu in about a week.', zh: '他大约一周就从流感中恢复了。', blanks: ['recovered'] },
    { id: 'b1-health-3', level: 'B1', category: 'health', text: 'Listening to music helps me relax after work.', zh: '听音乐帮助我下班后放松。', blanks: ['relax'] },
    { id: 'b1-social-1', level: 'B1', category: 'social', text: 'It was kind of you to remember my birthday.', zh: '你还记得我的生日，真好。', blanks: ['remember'] },
    { id: 'b1-social-2', level: 'B1', category: 'social', text: 'I would rather stay home than go to a noisy party.', zh: '比起去吵闹的派对，我更愿意待在家里。', blanks: ['noisy'] },
    { id: 'b1-social-3', level: 'B1', category: 'social', text: 'Let me know if you need a hand with anything.', zh: '如果你需要帮忙，告诉我。', blanks: ['anything'] },

    /* ---------------------------- B2 ---------------------------- */
    { id: 'b2-daily-1', level: 'B2', category: 'daily', text: 'I have grown accustomed to the noise of the city.', zh: '我已经习惯了城市的噪音。', blanks: ['accustomed'] },
    { id: 'b2-daily-2', level: 'B2', category: 'daily', text: 'Throwing things away without thinking harms the environment.', zh: '不加思索地扔东西会破坏环境。', blanks: ['environment'] },
    { id: 'b2-daily-3', level: 'B2', category: 'daily', text: 'She keeps her apartment tidy out of habit.', zh: '她出于习惯把公寓收拾得很整洁。', blanks: ['apartment'] },
    { id: 'b2-travel-1', level: 'B2', category: 'travel', text: 'The itinerary was packed, but we still had time to wander.', zh: '行程很满，但我们仍有时间闲逛。', blanks: ['itinerary'] },
    { id: 'b2-travel-2', level: 'B2', category: 'travel', text: 'Traveling abroad has broadened my view of the world.', zh: '出国旅行开阔了我对世界的看法。', blanks: ['broadened'] },
    { id: 'b2-travel-3', level: 'B2', category: 'travel', text: 'We were stranded at the airport overnight.', zh: '我们被困在机场过了一夜。', blanks: ['stranded'] },
    { id: 'b2-food-1', level: 'B2', category: 'food', text: 'The recipe calls for fresh herbs and a pinch of pepper.', zh: '这个食谱需要新鲜香草和少许胡椒。', blanks: ['recipe'] },
    { id: 'b2-food-2', level: 'B2', category: 'food', text: 'Processed food tends to contain too much sodium.', zh: '加工食品往往含钠过多。', blanks: ['sodium'] },
    { id: 'b2-food-3', level: 'B2', category: 'food', text: 'He has a tendency to skip breakfast when busy.', zh: '他忙起来往往不吃早饭。', blanks: ['tendency'] },
    { id: 'b2-shopping-1', level: 'B2', category: 'shopping', text: 'The retailer offered a generous warranty on the laptop.', zh: '这家零售商为笔记本提供了慷慨的保修。', blanks: ['warranty'] },
    { id: 'b2-shopping-2', level: 'B2', category: 'shopping', text: 'Impulse buying often leads to regret.', zh: '冲动购物常常导致后悔。', blanks: ['Impulse'] },
    { id: 'b2-shopping-3', level: 'B2', category: 'shopping', text: 'The item was out of stock, so I placed an order.', zh: '商品缺货，所以我下了订单。', blanks: ['stock'] },
    { id: 'b2-study-1', level: 'B2', category: 'study', text: 'The professor encouraged us to question established theories.', zh: '教授鼓励我们质疑既定理论。', blanks: ['established'] },
    { id: 'b2-study-2', level: 'B2', category: 'study', text: 'Summarizing a text reveals whether you truly understood it.', zh: '概括一篇文章能看出你是否真正理解。', blanks: ['Summarizing'] },
    { id: 'b2-study-3', level: 'B2', category: 'study', text: 'She is conducting research on second language acquisition.', zh: '她正在做第二语言习得研究。', blanks: ['conducting', 'acquisition'] },
    { id: 'b2-work-1', level: 'B2', category: 'work', text: 'Negotiating a fair salary requires preparation.', zh: '谈一份公平的薪水需要做好准备。', blanks: ['Negotiating'] },
    { id: 'b2-work-2', level: 'B2', category: 'work', text: 'Our team collaborates closely with the design department.', zh: '我们团队与设计部门紧密合作。', blanks: ['collaborates'] },
    { id: 'b2-work-3', level: 'B2', category: 'work', text: 'He resigned because he was unhappy with the management.', zh: '他因对管理层不满而辞职。', blanks: ['resigned'] },
    { id: 'b2-health-1', level: 'B2', category: 'health', text: 'Chronic stress can weaken the immune system.', zh: '长期压力会削弱免疫系统。', blanks: ['Chronic'] },
    { id: 'b2-health-2', level: 'B2', category: 'health', text: 'She was prescribed antibiotics for the infection.', zh: '医生为感染给她开了抗生素。', blanks: ['antibiotics'] },
    { id: 'b2-health-3', level: 'B2', category: 'health', text: 'Maintaining a balanced diet requires discipline.', zh: '保持均衡饮食需要自律。', blanks: ['discipline'] },
    { id: 'b2-social-1', level: 'B2', category: 'social', text: 'He apologized sincerely for the misunderstanding.', zh: '他为这个误会真诚地道歉。', blanks: ['misunderstanding'] },
    { id: 'b2-social-2', level: 'B2', category: 'social', text: 'I appreciate your honest feedback, even when it hurts.', zh: '我感谢你的坦诚反馈，即使它让人难受。', blanks: ['feedback'] },
    { id: 'b2-social-3', level: 'B2', category: 'social', text: 'Building trust takes time but can be lost in seconds.', zh: '建立信任需要时间，却可能在几秒内失去。', blanks: ['trust'] },

    /* ---------------------------- C1 ---------------------------- */
    { id: 'c1-daily-1', level: 'C1', category: 'daily', text: 'The sheer amount of clutter in the attic overwhelmed me.', zh: '阁楼里堆积如山的杂物让我不知所措。', blanks: ['clutter', 'overwhelmed'] },
    { id: 'c1-daily-2', level: 'C1', category: 'daily', text: 'Adopting a minimalist lifestyle has its own compromises.', zh: '采取极简生活方式也有其妥协之处。', blanks: ['minimalist', 'compromises'] },
    { id: 'c1-travel-1', level: 'C1', category: 'travel', text: 'The remote village remains untouched by mass tourism.', zh: '这个偏远村庄尚未被大众旅游触及。', blanks: ['untouched'] },
    { id: 'c1-travel-2', level: 'C1', category: 'travel', text: 'Navigating the maze of alleys required a good sense of direction.', zh: '在迷宫般的小巷中穿行需要良好的方向感。', blanks: ['Navigating'] },
    { id: 'c1-food-1', level: 'C1', category: 'food', text: 'Aromatic spices define the character of the regional cuisine.', zh: '芳香的香料定义了当地菜肴的特色。', blanks: ['Aromatic', 'cuisine'] },
    { id: 'c1-food-2', level: 'C1', category: 'food', text: 'Excessive consumption of refined sugar poses serious risks.', zh: '过度摄入精制糖会带来严重风险。', blanks: ['Excessive', 'refined'] },
    { id: 'c1-shopping-1', level: 'C1', category: 'shopping', text: 'Consumers are easily swayed by aggressive advertising.', zh: '消费者很容易被激进的广告影响。', blanks: ['swayed'] },
    { id: 'c1-shopping-2', level: 'C1', category: 'shopping', text: 'The warranty became void once the seal was broken.', zh: '封条一旦被撕开，保修就失效了。', blanks: ['void'] },
    { id: 'c1-study-1', level: 'C1', category: 'study', text: 'Critical thinking is indispensable in academic writing.', zh: '批判性思维在学术写作中不可或缺。', blanks: ['indispensable'] },
    { id: 'c1-study-2', level: 'C1', category: 'study', text: 'The thesis argues that motivation outweighs innate talent.', zh: '该论文认为动机比天赋更重要。', blanks: ['outweighs', 'innate'] },
    { id: 'c1-work-1', level: 'C1', category: 'work', text: 'Streamlining the workflow improved productivity considerably.', zh: '精简工作流程显著提高了生产率。', blanks: ['Streamlining', 'considerably'] },
    { id: 'c1-work-2', level: 'C1', category: 'work', text: 'Delegating tasks effectively is a hallmark of strong leadership.', zh: '有效授权是优秀领导力的标志。', blanks: ['hallmark'] },
    { id: 'c1-health-1', level: 'C1', category: 'health', text: 'Prolonged exposure to screens can strain your eyesight.', zh: '长时间面对屏幕会损害视力。', blanks: ['Prolonged', 'exposure'] },
    { id: 'c1-health-2', level: 'C1', category: 'health', text: 'Sedentary habits are strongly correlated with obesity.', zh: '久坐习惯与肥胖密切相关。', blanks: ['Sedentary', 'correlated'] },
    { id: 'c1-social-1', level: 'C1', category: 'social', text: 'He seldom expresses his emotions openly.', zh: '他很少公开表达自己的情感。', blanks: ['seldom'] },
    { id: 'c1-social-2', level: 'C1', category: 'social', text: 'A sincere apology can mend a fractured relationship.', zh: '真诚的道歉能修复破裂的关系。', blanks: ['fractured'] },

    /* ---------------------------- C2 ---------------------------- */
    { id: 'c2-daily-1', level: 'C2', category: 'daily', text: 'The relentless pace of modern life leaves little room for reflection.', zh: '现代生活无情的节奏几乎没有留给反思的空间。', blanks: ['relentless', 'reflection'] },
    { id: 'c2-daily-2', level: 'C2', category: 'daily', text: 'Nostalgia often romanticizes a past that never quite existed.', zh: '怀旧常常把从未真正存在的过去浪漫化。', blanks: ['Nostalgia', 'romanticizes'] },
    { id: 'c2-travel-1', level: 'C2', category: 'travel', text: 'The expedition was fraught with unforeseen perils.', zh: '这次探险充满了无法预见的危险。', blanks: ['fraught', 'perils'] },
    { id: 'c2-travel-2', level: 'C2', category: 'travel', text: 'Few destinations retain their unspoiled charm once discovered.', zh: '一旦被发现，很少有目的地能保持其未受破坏的魅力。', blanks: ['unspoiled'] },
    { id: 'c2-food-1', level: 'C2', category: 'food', text: 'The subtle interplay of textures elevates the dish beyond mere sustenance.', zh: '质地间微妙的相互作用让这道菜超越了单纯的果腹。', blanks: ['interplay', 'sustenance'] },
    { id: 'c2-food-2', level: 'C2', category: 'food', text: 'Overindulgence, however delightful, invariably exacts a toll.', zh: '过度放纵虽然令人愉悦，却总是要付出代价。', blanks: ['Overindulgence', 'invariably'] },
    { id: 'c2-study-1', level: 'C2', category: 'study', text: 'Rigorous methodology is what distinguishes credible scholarship.', zh: '严谨的方法论是可靠学术的区分标志。', blanks: ['Rigorous', 'methodology'] },
    { id: 'c2-study-2', level: 'C2', category: 'study', text: 'Learners who tolerate ambiguity tend to progress faster.', zh: '能容忍模糊性的学习者往往进步更快。', blanks: ['ambiguity'] },
    { id: 'c2-work-1', level: 'C2', category: 'work', text: 'An intransigent stance during negotiations rarely yields concessions.', zh: '谈判中顽固的立场很少能换来让步。', blanks: ['intransigent', 'concessions'] },
    { id: 'c2-work-2', level: 'C2', category: 'work', text: 'She deftly defused a potentially embarrassing confrontation.', zh: '她巧妙地化解了一场可能尴尬的对峙。', blanks: ['deftly', 'defused'] },
    { id: 'c2-health-1', level: 'C2', category: 'health', text: 'Chronic ailments often stem from seemingly trivial lifestyle choices.', zh: '慢性疾病往往源于看似微不足道的生活方式选择。', blanks: ['ailments', 'trivial'] },
    { id: 'c2-health-2', level: 'C2', category: 'health', text: 'The prognosis depends largely on how promptly treatment begins.', zh: '预后在很大程度上取决于治疗开始得是否及时。', blanks: ['prognosis', 'promptly'] },
    { id: 'c2-social-1', level: 'C2', category: 'social', text: 'Candor, when tempered with tact, strengthens relationships.', zh: '坦率在得体的调和下能增进关系。', blanks: ['Candor', 'tempered'] },
    { id: 'c2-social-2', level: 'C2', category: 'social', text: 'He has an uncanny ability to put strangers at ease.', zh: '他有让陌生人放松的奇特能力。', blanks: ['uncanny'] }
  ]
};
