/**
 * 纯逻辑层的自测（不需要浏览器）。
 * 运行： node tests/engine.test.mjs
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const Engine = require('../assets/js/engine.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('tokenize');

test('保留空格与标点', () => {
  const items = Engine.tokenize("Hello, don't stop!");
  assert.deepEqual(
    items.map((i) => [i.kind, i.text]),
    [
      ['word', 'Hello'],
      ['text', ', '],
      ['word', "don't"],
      ['text', ' '],
      ['word', 'stop'],
      ['text', '!']
    ]
  );
});

test('连字符与数字算一个词', () => {
  const words = Engine.tokenize('A well-known 3rd-party tool.').filter((i) => i.kind === 'word').map((i) => i.text);
  assert.deepEqual(words, ['A', 'well-known', '3rd-party', 'tool']);
});

console.log('buildExercise — 填空模式');

test('显式 blanks 会被采用', () => {
  const ex = Engine.buildExercise({ text: 'I need a new pair of shoes.', level: 'A1', blanks: ['shoes'] });
  assert.equal(ex.mode, 'fill');
  assert.deepEqual(ex.blanks.map((b) => b.text), ['shoes']);
});

test('自动挖空只挖实词，不会挖 the / of', () => {
  const ex = Engine.buildExercise({ text: 'The manager of the hotel was extremely helpful.', level: 'B2' });
  assert.ok(ex.blanks.length >= 1);
  assert.ok(ex.blanks.every((b) => !Engine.STOPWORDS.has(b.key)), JSON.stringify(ex.blanks));
  assert.ok(ex.blanks.some((b) => b.text === 'extremely'), '应该挖到最长的实词');
});

test('短句只挖一个空', () => {
  const ex = Engine.buildExercise({ text: 'It is cold.', level: 'C2' });
  assert.equal(ex.blanks.length, 1);
});

test('填空模式下 blanks 顺序按句子顺序', () => {
  const ex = Engine.buildExercise({ text: 'Regular exercise reduces the risk of heart disease.', level: 'B1', blanks: ['exercise', 'disease'] });
  assert.deepEqual(ex.blanks.map((b) => b.text), ['exercise', 'disease']);
  assert.ok(ex.blanks[0].itemIndex < ex.blanks[1].itemIndex);
});

console.log('buildExercise — 默写模式');

test('默写模式挖掉所有单词', () => {
  const ex = Engine.buildExercise({ text: 'Practice makes perfect.', level: 'A1' }, { mode: 'dictation' });
  assert.equal(ex.blanks.length, 3);
  assert.equal(ex.blanks.map((b) => b.text).join(' '), 'Practice makes perfect');
});

test('isBlank / blankAt 与 items 对应', () => {
  const ex = Engine.buildExercise({ text: 'Practice makes perfect.', level: 'A1' }, { mode: 'dictation' });
  ex.items.forEach((it, i) => {
    assert.equal(ex.isBlank(i), it.kind === 'word');
    if (it.kind === 'word') assert.equal(ex.blankAt(i).text, it.text);
  });
});

console.log('check');

test('完全正确', () => {
  const ex = Engine.buildExercise({ text: 'I need new shoes.', level: 'A1', blanks: ['shoes'] });
  const res = Engine.check(ex, ['shoes']);
  assert.equal(res.correct, true);
  assert.equal(res.mistakes, 0);
  assert.equal(res.results[0].status, 'ok');
});

test('大小写与空格不敏感', () => {
  const ex = Engine.buildExercise({ text: 'Where is the station?', level: 'A1', blanks: ['station'] });
  assert.equal(Engine.check(ex, ['  Station ']).correct, true);
});

test('同长度写错 → 逐字标红', () => {
  const ex = Engine.buildExercise({ text: 'I need new shoes.', level: 'A1', blanks: ['shoes'] });
  const res = Engine.check(ex, ['shors']);
  assert.equal(res.correct, false);
  assert.equal(res.mistakes, 1);
  assert.equal(res.results[0].status, 'wrong');
  assert.deepEqual(res.results[0].marks.map((m) => m.ok), [true, true, true, false, true]);
  assert.equal(res.results[0].marks[3].ch, 'e');
  assert.equal(res.results[0].marks[3].typed, 'r');
});

test('漏写字母 → mark.typed 为 null', () => {
  const ex = Engine.buildExercise({ text: 'I need shoes now.', level: 'A1', blanks: ['shoes'] });
  const res = Engine.check(ex, ['shoe']);
  const marks = res.results[0].marks;
  assert.equal(marks.length, 5);
  assert.equal(marks[4].ok, false);
  assert.equal(marks[4].typed, null);
  assert.deepEqual(res.results[0].extra, []);
});

test('多写字母 → 进入 extra', () => {
  const ex = Engine.buildExercise({ text: 'I need shoes now.', level: 'A1', blanks: ['shoes'] });
  const res = Engine.check(ex, ['shoess']);
  assert.deepEqual(res.results[0].extra, ['s']);
});

test('空着不写 → missing，且算一处错误', () => {
  const ex = Engine.buildExercise({ text: 'I need shoes now.', level: 'A1', blanks: ['shoes'] });
  const res = Engine.check(ex, ['']);
  assert.equal(res.results[0].status, 'missing');
  assert.equal(res.correct, false);
  assert.equal(res.answered, false);
});

test('多个空：只有一个错也算整体错', () => {
  const ex = Engine.buildExercise({ text: 'I need new shoes and socks.', level: 'A1', blanks: ['shoes', 'socks'] });
  const res = Engine.check(ex, ['shoes', 'sockz']);
  assert.equal(res.correct, false);
  assert.equal(res.mistakes, 1);
  assert.equal(res.results[0].status, 'ok');
  assert.equal(res.results[1].status, 'wrong');
});

test('打乱后顺序不变（shuffle 不改原数组）', () => {
  const src = [1, 2, 3, 4, 5];
  const out = Engine.shuffle(src);
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual(out.slice().sort(), src);
});

console.log('\n' + passed + ' 项通过' + (process.exitCode ? '，有失败项' : ''));
