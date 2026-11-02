import type { LayerComponent } from '../registry';

/** Camera layers draw nothing themselves; PlanVideo applies their effect to the base video (see cameraStyle). */
export const Camera: LayerComponent = () => null;
