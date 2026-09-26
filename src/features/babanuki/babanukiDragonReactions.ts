import type { PublicDragonReactionInput } from '../../components/dragonReactions';
import type { BabanukiEvent, BabanukiPlayer } from './babanukiTypes';

const levels = ['very-easy', 'easy', 'normal', 'hard', 'very-hard'] as const;

function cue(
  player: BabanukiPlayer | undefined,
  matchId: string,
  sequence: number,
  kind: string,
  outcome: PublicDragonReactionInput['outcome'],
  factLabel: string,
  priority: PublicDragonReactionInput['priority'],
): PublicDragonReactionInput | null {
  if (!player?.isCpu) return null;
  const index = levels.indexOf(player.cpuLevel);
  if (index < 0) return null;
  return {
    matchId, sequence, kind,
    cpu: { id: player.id, name: player.name, level: (index + 1) as 1 | 2 | 3 | 4 | 5 },
    outcome, factLabel, priority,
    severity: priority && priority >= 3 ? 'major' : 'normal',
  };
}

/** Read only the event's public kind, actor, rank, and die. Never inspect card IDs or hands. */
export function detectBabanukiDragonReactions(
  event: BabanukiEvent,
  players: readonly BabanukiPlayer[],
  matchId: string,
  sequence: number,
): PublicDragonReactionInput[] {
  const player = (id: string) => players.find(entry => entry.id === id);
  let reaction: PublicDragonReactionInput | null = null;
  switch (event.kind) {
    case 'discard-pair':
      reaction = cue(player(event.playerId), matchId, sequence, 'babanuki-pair', 'advantage', `${player(event.playerId)?.name ?? 'CPU'}がペア成立`, 2);
      break;
    case 'shuffle':
      reaction = cue(player(event.declarerId), matchId, sequence,
        event.dice === 4 ? 'babanuki-shuffle-four' : 'babanuki-shuffle',
        event.dice === 4 ? 'disadvantage' : 'advantage',
        event.dice === 4 ? '出目4、札の移動なし' : `出目${event.dice}でシャッフル`,
        event.dice === 4 ? 2 : 3);
      break;
    case 'finish':
      reaction = cue(player(event.playerId), matchId, sequence, 'babanuki-finish', 'victory', `${event.rank}位で勝ち抜け`, 4);
      break;
    case 'game-end':
      reaction = cue(player(event.loserId), matchId, sequence, 'babanuki-loser', 'defeat', '最弱王が決定', 4);
      break;
    // Drawing a particular card, even a Joker, must never signal its identity.
    case 'draw':
    case 'initial-discard':
      break;
  }
  return reaction ? [reaction] : [];
}

export function detectBabanukiShuffleAnnouncement(
  declarerId: string,
  players: readonly BabanukiPlayer[],
  matchId: string,
  sequence: number,
): PublicDragonReactionInput[] {
  const reaction = cue(players.find(player => player.id === declarerId), matchId, sequence,
    'babanuki-shuffle-declared', 'advantage', 'シャッフル宣言', 2);
  return reaction ? [reaction] : [];
}
