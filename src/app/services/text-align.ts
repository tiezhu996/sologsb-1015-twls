import type { CharDiff, DiffHunk } from '../models/poem.models';

/**
 * 基于最长公共子序列的逐字对齐。
 * 先求两版本的最长公共子序列，再把相邻的删、合并不了的多余字配成“换”，
 * 这样一处增删只影响本段，后面的字仍然对齐。
 */
export function alignTexts(leftText: string, rightText: string): CharDiff[] {
  const left = Array.from(leftText.replace(/\n/g, ''));
  const right = Array.from(rightText.replace(/\n/g, ''));
  const rows: CharDiff[] = [];
  if (!left.length && !right.length) return rows;

  // lcs[i][j] = left[i:] 与 right[j:] 的最长公共子序列长度
  const lcs: number[][] = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lcs[i][j] = left[i] === right[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // 回溯得到 相同 / 删 / 增 操作流
  const ops: { type: 'same' | 'delete' | 'insert'; left: string; right: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      ops.push({ type: 'same', left: left[i], right: right[j] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'delete', left: left[i], right: '' });
      i++;
    } else {
      ops.push({ type: 'insert', left: '', right: right[j] });
      j++;
    }
  }
  while (i < left.length) ops.push({ type: 'delete', left: left[i++], right: '' });
  while (j < right.length) ops.push({ type: 'insert', left: '', right: right[j++] });

  // 两个相同字之间的删/增构成一段差异：能配对的算作“换”，余下的算作“删”或“增”
  let k = 0;
  let hunk = -1;
  while (k < ops.length) {
    const op = ops[k];
    if (op.type === 'same') {
      rows.push({ index: rows.length, left: op.left, right: op.right, changed: false, type: 'same', hunk: -1 });
      k++;
      continue;
    }
    hunk++;
    const deleted: string[] = [];
    const inserted: string[] = [];
    while (k < ops.length && ops[k].type !== 'same') {
      if (ops[k].type === 'delete') deleted.push(ops[k].left);
      else inserted.push(ops[k].right);
      k++;
    }
    const paired = Math.min(deleted.length, inserted.length);
    for (let p = 0; p < paired; p++) {
      rows.push({ index: rows.length, left: deleted[p], right: inserted[p], changed: true, type: 'replace', hunk });
    }
    for (let p = paired; p < deleted.length; p++) {
      rows.push({ index: rows.length, left: deleted[p], right: '', changed: true, type: 'delete', hunk });
    }
    for (let p = paired; p < inserted.length; p++) {
      rows.push({ index: rows.length, left: '', right: inserted[p], changed: true, type: 'insert', hunk });
    }
  }
  return rows;
}

/** 把对齐结果中的差异行归并成差异段，一处连续增删换只算一处 */
export function collectHunks(rows: CharDiff[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  rows.forEach((row) => {
    if (!row.changed) return;
    const last = hunks[hunks.length - 1];
    if (last && last.hunk === row.hunk) {
      last.endIndex = row.index;
    } else {
      hunks.push({ hunk: row.hunk, startIndex: row.index, endIndex: row.index });
    }
  });
  return hunks;
}
