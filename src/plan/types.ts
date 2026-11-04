export type Track = 'scene' | 'caption' | 'title' | 'graphic' | 'footage' | 'camera';
export interface Word { t: string; s: number; e: number; hl: boolean }
export interface Scene { id: string; start: number; end: number; role: 'talking-head' | 'explainer' | 'insert' }
export interface Layer {
  id: string; track: Track; type?: string; start: number; end: number;
  words?: Word[]; props?: Record<string, unknown>; override?: Record<string, unknown>; locked?: boolean;
}
export interface Plan {
  version: 1;
  meta: { source: string; fps: number; width: number; height: number; style: string; fit?: 'cover' | 'contain'; focus?: { x: number; y: number } };
  scenes: Scene[];
  layers: Layer[];
}
export interface Issue { severity: 'error' | 'warning'; code: string; layerId?: string; message: string }
