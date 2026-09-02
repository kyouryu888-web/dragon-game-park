import { describe, expect, it } from 'vitest';
import sql from '../../../supabase/bakuretsu_reversi_rooms.sql?raw';

describe('Bakuretsu Reversi server-authoritative SQL contract', () => {
  it('denies direct table access and exposes only participant-checked RPC operations', () => {
    expect(sql).toContain('revoke all on public.bakuretsu_reversi_rooms from anon, authenticated');
    expect(sql).not.toContain('using (true)');
    expect(sql).toContain('and (host_id=p_player_id or guest_id=p_player_id)');
    expect(sql).toContain('and host_id=p_player_id');
    expect(sql.match(/security definer/g)).toHaveLength(7);
    expect(sql).not.toContain('grant execute on function public.push_bakuretsu_reversi_snapshot');
  });

  it('accepts only a move and executes the verified rule pipeline inside the locked RPC', () => {
    expect(sql).toContain('create or replace function public.submit_bakuretsu_reversi_move(');
    expect(sql).toContain('p_room_code text,p_player_id text,p_move jsonb,p_timeout boolean,p_version bigint');
    expect(sql).toContain('and version=p_version for update');
    expect(sql).toContain('v_result:=public.bakuretsu_reversi_apply_move(v_room.game_state,v_move)');
    expect(sql).toContain("-- flipBeforeBlast=true: 裏返しを爆発より先に確定する。");
    expect(sql).toContain("or v_cell ->> 'owner' = v_snap ->> 'owner' then continue");
    expect(sql).not.toContain('grant execute on function public.create_bakuretsu_reversi_room(text,text,text,jsonb');
  });

  it('redacts every returned state with the same boundaries as view.ts', () => {
    expect(sql).toContain('create or replace function public.bakuretsu_reversi_redact');
    expect(sql).toContain("v_cell ->> 'state' = 'FACEDOWN'");
    expect(sql).toMatch(/array\['specialType'\],\s*'"NONE"'::jsonb/);
    expect(sql).toMatch(/array\['durability'\],\s*'0'::jsonb/);
    expect(sql).toContain("array['hands',v_foe,'specialPieces']");
    expect(sql).toMatch(/array\['hands',v_foe,'dummyCount'\],\s*'-1'::jsonb/);
    expect(sql).toContain("v_state jsonb := public.bakuretsu_reversi_redact(p_room.game_state,p_viewer_side)");
    expect(sql).toContain("public.bakuretsu_reversi_redact(v_result -> 'state',p_viewer_side)");
  });

  it('keeps the twenty-minute bank authoritative and excludes the slowest playback duration', () => {
    expect(sql).toContain("'{\"BLACK\":1200000,\"WHITE\":1200000}'::jsonb");
    expect(sql).toContain("v_move:=public.bakuretsu_reversi_choose_auto_move(v_room.game_state)");
    expect(sql).toContain('order by flips,square/8,square%8');
    expect(sql).toContain('if v_automatic and v_auto_count>=5 then');
    expect(sql).toContain("array['endReason'],'\"ABANDON\"'::jsonb");
    expect(sql).toContain('v_playback_ms:=public.bakuretsu_reversi_playback_ms(v_result)');
    expect(sql).toContain('return v_ms * 2');
    expect(sql).toContain('create or replace function public.ack_bakuretsu_reversi_playback(');
    expect(sql).toContain('if v_room.playback_ready_at is null or v_now<v_room.playback_ready_at then return null');
    expect(sql).toContain('if v_room.turn_started_at is null or v_now<v_room.turn_started_at then return null');
    expect(sql).toContain('pg_catalog.jsonb_agg(value order by ordinal)');
    expect(sql).toContain("v_room.turn_deadline+interval '30 seconds'");
  });
});
