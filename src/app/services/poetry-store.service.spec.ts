import { TestBed } from '@angular/core/testing';
import type { PoemVersion } from '../models/poem.models';
import { PoetryStoreService } from './poetry-store.service';

function makeVersion(id: string, text: string): PoemVersion {
  return { id, name: id, source: '', createdAt: '', text, marks: {}, antithesisPairs: [] };
}

describe('PoetryStoreService 异文对齐与定位', () => {
  let store: PoetryStoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(PoetryStoreService);
  });

  function compare(leftText: string, rightText: string): void {
    store.workspace.set({
      ...store.workspace(),
      versions: [makeVersion('base', leftText), makeVersion('current', rightText)],
      activeVersionId: 'current',
    });
    store.baselineVersionId.set('base');
    TestBed.flushEffects();
  }

  it('中间增字只算一处差异，后面的字仍然对齐', () => {
    compare('床前明月光疑是地上霜', '床前明月的光疑是地上霜');
    const rows = store.diff();
    expect(rows.length).toBe(11);
    expect(store.differences().length).toBe(1);
    const changed = rows.filter((row) => row.changed);
    expect(changed.length).toBe(1);
    expect(changed[0].type).toBe('insert');
    expect(changed[0].left).toBe('');
    expect(changed[0].right).toBe('的');
    const after = rows.slice(changed[0].index + 1);
    expect(after.every((row) => !row.changed && row.left === row.right)).toBeTrue();
    expect(after.map((row) => row.right).join('')).toBe('光疑是地上霜');
  });

  it('中间删字只算一处差异，类型为删', () => {
    compare('床前明月光疑是地上霜', '床前光疑是地上霜');
    expect(store.differences().length).toBe(1);
    const changed = store.diff().filter((row) => row.changed);
    expect(changed.map((row) => row.left).join('')).toBe('明月');
    expect(changed.every((row) => row.type === 'delete' && row.right === '')).toBeTrue();
    expect(changed.every((row) => row.hunk === changed[0].hunk)).toBeTrue();
  });

  it('换字标为换，左右各保留原字', () => {
    compare('床前明月光疑是地上霜', '床前明月光疑是池上霜');
    expect(store.differences().length).toBe(1);
    const changed = store.diff().filter((row) => row.changed);
    expect(changed.length).toBe(1);
    expect(changed[0].type).toBe('replace');
    expect(changed[0].left).toBe('地');
    expect(changed[0].right).toBe('池');
  });

  it('互不相邻的修改分成多处差异', () => {
    compare('床前明月光疑是地上霜', '窗前明月光疑是池上霜');
    expect(store.differences().length).toBe(2);
  });

  it('定位按钮依次走并在末尾回到第一处', () => {
    compare('床前明月光疑是地上霜', '窗前明月光疑是池上霜');
    expect(store.currentDiffIndex()).toBe(0);
    store.nextDifference();
    expect(store.currentDiffIndex()).toBe(1);
    store.nextDifference();
    expect(store.currentDiffIndex()).toBe(0);
    store.previousDifference();
    expect(store.currentDiffIndex()).toBe(1);
    store.previousDifference();
    expect(store.currentDiffIndex()).toBe(0);
  });

  it('正文改过之后定位从第一处重来', () => {
    compare('床前明月光疑是地上霜', '窗前明月光疑是池上霜');
    store.nextDifference();
    expect(store.currentDiffIndex()).toBe(1);
    store.updateText('窗前明月光疑是地上霜');
    TestBed.flushEffects();
    expect(store.currentDiffIndex()).toBe(0);
  });

  it('换了比较底本之后定位从第一处重来', () => {
    compare('床前明月光疑是地上霜', '窗前明月光疑是池上霜');
    store.workspace.set({
      ...store.workspace(),
      versions: [...store.workspace().versions, makeVersion('other', '窗前明月光疑是地上霜')],
    });
    store.nextDifference();
    expect(store.currentDiffIndex()).toBe(1);
    store.baselineVersionId.set('other');
    TestBed.flushEffects();
    expect(store.currentDiffIndex()).toBe(0);
  });

  it('点击字格定位到所属差异段', () => {
    compare('床前明月光疑是地上霜', '窗前明月光疑是池上霜');
    const second = store.differences()[1];
    store.focusHunk(second.hunk);
    expect(store.currentDiffIndex()).toBe(1);
    expect(store.currentHunk()).toBe(second.hunk);
    store.focusHunk(-1);
    expect(store.currentDiffIndex()).toBe(1);
  });

  it('两本相同或底本即当前稿时没有差异', () => {
    compare('床前明月光疑是地上霜', '床前明月光疑是地上霜');
    expect(store.differences().length).toBe(0);
    expect(store.currentHunk()).toBe(-1);
    store.baselineVersionId.set('current');
    TestBed.flushEffects();
    expect(store.diff().length).toBe(0);
    store.nextDifference();
    expect(store.currentDiffIndex()).toBe(0);
  });
});
