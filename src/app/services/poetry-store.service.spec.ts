import { TestBed } from '@angular/core/testing';
import { PoetryStoreService } from './poetry-store.service';

describe('PoetryStoreService 异文比较', () => {
  let service: PoetryStoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PoetryStoreService);
  });

  // 把 version-main 作为当前稿、version-song 作为底本，并写入指定正文
  function prepareComparison(activeText: string, baselineText: string): void {
    service.updateText(activeText);
    service.selectVersion('version-song');
    service.updateText(baselineText);
    service.selectVersion('version-main');
    service.baselineVersionId.set('version-song');
  }

  it('未选底本时没有差异，定位保持复位', () => {
    expect(service.differences()).toEqual([]);
    service.nextDifference();
    expect(service.currentDiffIndex()).toBe(-1);
  });

  it('底本中间少一个字：只记一处“多字”，后面的字仍然对齐', () => {
    prepareComparison('花落不知多少', '花落知多少');
    expect(service.differences()).toEqual([2]);
    const slot = service.diff()[2];
    expect(slot.kind).toBe('insert');
    expect(slot.left).toBe('');
    expect(slot.right).toBe('不');
    expect(service.diff()[3]).toEqual(jasmine.objectContaining({ kind: 'same', left: '知', right: '知' }));
    expect(service.diff()[5]).toEqual(jasmine.objectContaining({ kind: 'same', left: '少', right: '少' }));
  });

  it('底本中间多一个字：只记一处“少字”，后面的字仍然对齐', () => {
    prepareComparison('花落知多少', '花落不知多少');
    expect(service.differences()).toEqual([2]);
    const slot = service.diff()[2];
    expect(slot.kind).toBe('delete');
    expect(slot.left).toBe('不');
    expect(slot.right).toBe('');
    expect(service.diff()[3]).toEqual(jasmine.objectContaining({ kind: 'same', left: '知', right: '知' }));
  });

  it('同位不同字记为“换字”', () => {
    prepareComparison('处处闻啼莺', '处处闻啼鸟');
    expect(service.differences()).toEqual([4]);
    const slot = service.diff()[4];
    expect(slot.kind).toBe('substitute');
    expect(slot.left).toBe('鸟');
    expect(slot.right).toBe('莺');
  });

  it('整首中间插入一字不会把后面每格都标成差异', () => {
    prepareComparison('春眠不觉晓，\n处处闻啼鸟。\n夜来风雨声，\n花落不知多少。', '春眠不觉晓，\n处处闻啼鸟。\n夜来风雨声，\n花落知多少。');
    expect(service.differences().length).toBe(1);
  });

  it('定位按钮按真实差异依次走，到末尾回到第一处', () => {
    prepareComparison('春眠不觉晓，\n处处闻啼鸟。', '春眠不知晓，\n处处见啼鸟。');
    expect(service.differences()).toEqual([3, 8]);
    expect(service.currentDiffIndex()).toBe(-1);

    service.nextDifference();
    expect(service.currentDiffIndex()).toBe(3);
    expect(service.currentDiffPosition()).toBe(1);

    service.nextDifference();
    expect(service.currentDiffIndex()).toBe(8);
    expect(service.currentDiffPosition()).toBe(2);

    service.nextDifference();
    expect(service.currentDiffIndex()).toBe(3);

    service.previousDifference();
    expect(service.currentDiffIndex()).toBe(8);

    service.previousDifference();
    expect(service.currentDiffIndex()).toBe(3);
  });

  it('正文改过之后定位从第一处重来', () => {
    prepareComparison('春眠不觉晓，\n处处闻啼鸟。', '春眠不知晓，\n处处见啼鸟。');
    service.nextDifference();
    service.nextDifference();
    expect(service.currentDiffIndex()).toBe(8);

    service.updateText('春眠不觉晓，\n处处闻啼花。');
    TestBed.flushEffects();
    expect(service.currentDiffIndex()).toBe(-1);

    service.nextDifference();
    expect(service.currentDiffIndex()).toBe(service.differences()[0]);
  });

  it('换了比较底本之后定位从第一处重来', () => {
    prepareComparison('春眠不觉晓，\n处处闻啼鸟。', '春眠不知晓，\n处处见啼鸟。');
    service.nextDifference();
    expect(service.currentDiffIndex()).toBe(3);

    service.baselineVersionId.set('version-main');
    TestBed.flushEffects();
    expect(service.currentDiffIndex()).toBe(-1);
    expect(service.differences()).toEqual([]);
  });
});
