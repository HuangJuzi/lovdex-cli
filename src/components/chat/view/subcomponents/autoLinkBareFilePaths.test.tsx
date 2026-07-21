import test from 'node:test';
import assert from 'node:assert/strict';

import { autoLinkBareFilePaths } from './Markdown';

test('links a bare path following CJK punctuation without swallowing the prefix', () => {
  const out = autoLinkBareFilePaths('结果图已保存：docs/output/result_1.png');
  assert.equal(out, '结果图已保存：[docs/output/result_1.png](docs/output/result_1.png)');
});

test('links a bare path at the start of a line', () => {
  const out = autoLinkBareFilePaths('docs/output/result_1.png 没有提示预览');
  assert.equal(out, '[docs/output/result_1.png](docs/output/result_1.png) 没有提示预览');
});

test('preserves a trailing :line:col suffix inside the link', () => {
  const out = autoLinkBareFilePaths('见 src/utils.py:130 文件');
  assert.equal(out, '见 [src/utils.py:130](src/utils.py:130) 文件');
});

test('does not link inside a URL', () => {
  const out = autoLinkBareFilePaths('visit https://example.com/a/b.png for docs');
  assert.equal(out, 'visit https://example.com/a/b.png for docs');
});

test('does not touch fenced code blocks', () => {
  const input = '```\nsee src/foo.ts here\n```';
  assert.equal(autoLinkBareFilePaths(input), input);
});

test('leaves existing markdown links intact', () => {
  const input = '[spec](docs/a.md) is here';
  assert.equal(autoLinkBareFilePaths(input), input);
});

test('leaves plain prose without a path unchanged', () => {
  const input = 'this is a plain sentence with no path';
  assert.equal(autoLinkBareFilePaths(input), input);
});

test('strips trailing sentence punctuation out of the link target', () => {
  const out = autoLinkBareFilePaths('打开 src/a.ts。');
  assert.equal(out, '打开 [src/a.ts](src/a.ts)。');
});
