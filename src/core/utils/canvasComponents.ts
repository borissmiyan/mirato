import { ICanvasItem } from '@/core/types';

/**
 * Creates a Figma-style Master Component (❖) from an existing canvas item or group.
 */
export function createMasterComponent(item: ICanvasItem): ICanvasItem {
  return {
    ...item,
    isMasterComponent: true,
    masterComponentId: undefined,
  };
}

/**
 * Instantiates an instance linked to a Master Component.
 */
export function createInstanceFromMaster(
  master: ICanvasItem,
  position?: { x: number; y: number }
): ICanvasItem {
  const instanceId = crypto.randomUUID();
  const { isMasterComponent: _, ...rest } = master;

  return {
    ...rest,
    id: instanceId,
    masterComponentId: master.id,
    componentOverrides: undefined,
    x: position?.x ?? (master.x + 2),
    y: position?.y ?? (master.y + 2),
  };
}

/**
 * Syncs structural and visual changes from a Master Component down to all its instances,
 * while respecting any explicit instance-level componentOverrides.
 */
export function syncMasterToInstances(
  master: ICanvasItem,
  instances: ICanvasItem[]
): ICanvasItem[] {
  return instances.map((inst) => {
    if (inst.masterComponentId !== master.id) return inst;

    const overrides = inst.componentOverrides || {};

    return {
      ...inst,
      // Sync dimensions unless overridden
      width: overrides.width ?? master.width,
      height: overrides.height ?? master.height,
      rotation: overrides.rotation ?? master.rotation,
      scale: overrides.scale ?? master.scale,
      opacity: overrides.opacity ?? master.opacity,
      borderRadius: overrides.borderRadius ?? master.borderRadius,
      // Sync style layers unless overridden
      fills: overrides.fills ?? master.fills,
      strokes: overrides.strokes ?? master.strokes,
      borderColor: overrides.borderColor ?? master.borderColor,
      borderWidth: overrides.borderWidth ?? master.borderWidth,
      strokeAlign: overrides.strokeAlign ?? master.strokeAlign,
      // Type specific data
      text: overrides.text ?? master.text,
      shape: overrides.shape ?? master.shape,
      stroke: overrides.stroke ?? master.stroke,
      path: overrides.path ?? master.path,
      // Auto Layout
      autoLayout: overrides.autoLayout ?? master.autoLayout,
      constraints: overrides.constraints ?? master.constraints,
    };
  });
}

/**
 * Detaches an instance from its master component, making it an independent regular item.
 */
export function detachInstance(instance: ICanvasItem): ICanvasItem {
  const { masterComponentId: _, componentOverrides: __, ...rest } = instance;
  return rest as ICanvasItem;
}

