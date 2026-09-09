import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { splitBands } from '../../src/entities/bikeAssets';

function makeGeometry(positions: number[][], indices: number[]): THREE.BufferGeometry {
  const flat = new Float32Array(positions.flat());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(flat, 3));
  geo.setIndex(indices);
  return geo;
}

function indicesOf(g: THREE.BufferGeometry | null): number[] {
  return g ? Array.from(g.getIndex()!.array as number[]) : [];
}

describe('splitBands', () => {
  it('按真实索引切分，非连续索引不产生破面', () => {
    // 两个三角形，索引非连续：[0,2,4] 全在低处（轮胎），[1,3,5] 全在高处（车身）
    const geo = makeGeometry(
      [
        [0, 0, 0],
        [0, 10, 0],
        [0, 0, 1],
        [0, 10, 1],
        [0, 0, 2],
        [0, 10, 2],
      ],
      [0, 2, 4, 1, 3, 5],
    );
    const { tire, bodyLower, bodyUpper } = splitBands(geo, 5, 8);
    expect(tire).not.toBeNull();
    expect(bodyUpper).not.toBeNull();
    expect(bodyLower).toBeNull();
    expect(indicesOf(tire)).toEqual([0, 2, 4]);
    expect(indicesOf(bodyUpper)).toEqual([1, 3, 5]);
  });

  it('使用三角形重心高度决定归属，而非只看第一个顶点', () => {
    // 三角形 [0,1,2]：一个顶点在 y=0，另两个在 y=10 → 重心 6.67 应归入「车身下部」
    const geo = makeGeometry(
      [
        [0, 0, 0],
        [0, 10, 0],
        [0, 10, 1],
      ],
      [0, 1, 2],
    );
    const { tire, bodyLower, bodyUpper } = splitBands(geo, 5, 8);
    expect(tire).toBeNull();
    expect(bodyLower).not.toBeNull();
    expect(bodyUpper).toBeNull();
    expect(indicesOf(bodyLower)).toEqual([0, 1, 2]);
  });

  it('所有原始三角形恰好进入一个分区，且索引均小于顶点数', () => {
    const geo = makeGeometry(
      [
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
        [0, 9, 0],
        [0, 10, 0],
        [0, 20, 0],
      ],
      [0, 1, 2, 3, 4, 5],
    );
    const { tire, bodyLower, bodyUpper } = splitBands(geo, 4, 10);
    const all = [...indicesOf(tire), ...indicesOf(bodyLower), ...indicesOf(bodyUpper)];
    expect(all.length).toBe(6);
    for (const i of all) expect(i).toBeLessThan(6);
    // 低位三角归轮胎，高位三角归车身，下部为空
    expect(indicesOf(tire)).toEqual([0, 1, 2]);
    expect(indicesOf(bodyUpper)).toEqual([3, 4, 5]);
    expect(bodyLower).toBeNull();
  });
});
