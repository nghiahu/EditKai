import { useMemo } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { PlanVideo } from '../../remotion/PlanVideo';
import type { Plan } from '../../src/plan/types';
import type { Theme } from '../../src/style/theme';
import { API } from './api';

interface Props { plan: Plan; theme: Theme; durationSec: number; playerRef: React.RefObject<PlayerRef | null>; showSafe: boolean; showFace: boolean }

export function Preview({ plan, theme, durationSec, playerRef, showSafe, showFace }: Props) {
  const { fps, width, height } = plan.meta;
  const inputProps = useMemo(
    () => ({ plan, theme, videoSrc: `${API}/media/${plan.meta.source}`, assetBase: `${API}/media`, durationSec }),
    [plan, theme, durationSec],
  );
  const sz = theme.limits.safeZone;
  const pct = (n: number) => `${n * 100}%`;
  return (
    <div className="stage" style={{ aspectRatio: `${width}/${height}` }}>
      <Player ref={playerRef} component={PlanVideo} inputProps={inputProps} durationInFrames={Math.max(1, Math.round(durationSec * fps))}
        fps={fps} compositionWidth={width} compositionHeight={height} controls acknowledgeRemotionLicense style={{ width: '100%', height: '100%' }} />
      {showSafe && <div className="zone" style={{ borderColor: '#2dd4bf', top: pct(sz.top), bottom: pct(sz.bottom), left: pct(sz.left), right: pct(sz.right) }} />}
      {showFace && <div className="zone" style={{ borderColor: '#f97316', top: '12%', left: '22%', right: '22%', height: '30%', borderRadius: '50%' }} />}
    </div>
  );
}
