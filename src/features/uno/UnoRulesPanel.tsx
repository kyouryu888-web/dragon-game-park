import type { UnoVariant } from './unoTypes';

const STANDARD_RULES = [
  ['同じ色', '場のカードと同じ色なら出せます。'],
  ['同じ数字', '数字が同じカードも出せます。'],
  ['同じ記号', 'リバースやスキップなど、同じ記号でも出せます。'],
  ['ウノ!', '手札があと1まいになったら「ウノ!」を押します。'],
];

const HARD_RULES = [
  ['25まいでアウト', '手札が25まい以上で負けです。'],
  ['ドローをかさねる', '同じか大きいドローで返せます。'],
  ['むげんドロー', '出せるカードが出るまで引きます。'],
  ['7 スワップ', 'えらんだ人と手札をぜんぶこうかん。'],
  ['0 パス', '全員がとなりの人に手札をわたします。'],
  ['カラー ルーレット', 'えらんだ色が出るまでひきつづけます。'],
  ['ぜんぶすてる', '同じ色の手札をぜんぶすてます。'],
  ['みんなスキップ', '自分いがい全員を1回おやすみ。'],
];

export function UnoRulesPanel({ variant }: { variant: UnoVariant }) {
  const rules = variant === 'hard' ? HARD_RULES : STANDARD_RULES;
  return (
    <div style={{
      background: variant === 'hard' ? '#2a1114' : '#fffaf0',
      color: variant === 'hard' ? '#fff5e8' : 'var(--text-mid)',
      border: `1.5px solid ${variant === 'hard' ? '#c33a30' : 'var(--border)'}`,
      borderRadius: 16,
      padding: '14px 14px',
      display: 'grid',
      gap: 8,
    }}>
      {rules.map(([title, text]) => (
        <div key={title} style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(98px, 0.72fr) 1fr',
          gap: 9,
          alignItems: 'start',
          fontSize: 12,
          lineHeight: 1.55,
        }}>
          <strong style={{
            color: variant === 'hard' ? '#ffd15c' : 'var(--brown)',
            fontSize: 12,
          }}>
            {title}
          </strong>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}
