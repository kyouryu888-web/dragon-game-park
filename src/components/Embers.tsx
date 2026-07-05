import { useMemo } from 'react';

/**
 * 画面全体に舞い上がる火の粉のオーバーレイ（ダークファンタジー演出の共通部品）。
 * 画面下端から金と緋の粒がゆっくり立ち上る。クリックは透過する。
 */
export function Embers({ count = 12 }: { count?: number }) {
  const spans = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const left = 4 + Math.random() * 92;
        const dur = 5 + Math.random() * 6;
        const delay = Math.random() * 8;
        const size = 2 + Math.random() * 3;
        return (
          <span
            key={i}
            style={{
              position: 'absolute', left: `${left}%`, bottom: -8,
              width: size, height: size, borderRadius: '50%',
              background: i % 3 === 0 ? '#e6c877' : '#e0733a',
              filter: 'blur(.5px)',
              animation: `emberRise ${dur}s ${delay}s linear infinite`,
              opacity: 0,
            }}
          />
        );
      }),
    [count],
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
      {spans}
    </div>
  );
}
