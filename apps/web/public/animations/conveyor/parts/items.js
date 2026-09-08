/*
  The shapes themselves, in three pools: stacked in the tubes, travelling from a
  tube to a box, and refilling from off frame. Each pool holds one object per
  shape per slot for the whole loop, so nothing is ever built or thrown away
  mid-run, and a frame is just a matter of which of them are showing and where.
*/
import * as THREE from "three";

import { CONFIG, ITEM } from "../config.js";
import { item, placeFalling, placeItem, SHAPES } from "../shapes.js";
import { TUBES } from "../timeline.js";

const stackAt = new THREE.Vector3();

function pool(scene, count) {
  return SHAPES.map((shape) => {
    const list = [];
    for (let j = 0; j < count; j++) {
      const object = item(shape.index);
      object.visible = false;
      scene.add(object);
      list.push(object);
    }
    return list;
  });
}

export function createItems(scene) {
  const stacked = pool(scene, CONFIG.tubeCapacity);
  const moving = pool(scene, CONFIG.itemsPerDrop);
  const refilling = pool(scene, CONFIG.itemsPerDrop);

  return {
    apply(frame) {
      // Only the tube being emptied has anything in the air, so every other
      // pool of travelling shapes is simply put away.
      for (const shape of SHAPES) {
        const active = shape.index === frame.shape;
        for (let m = 0; m < moving[shape.index].length; m++) {
          const object = moving[shape.index][m];
          const state = frame.falling[m];
          object.visible = active && state.visible;
          if (object.visible) placeFalling(object, shape.index, state);
        }

        for (let m = 0; m < refilling[shape.index].length; m++) {
          const object = refilling[shape.index][m];
          const state = frame.refill[shape.index][m];
          object.visible = state.visible;
          if (object.visible) placeFalling(object, shape.index, state);
        }

        const tube = TUBES[shape.index];
        const { count, shift } = frame.stacks[shape.index];
        for (let j = 0; j < stacked[shape.index].length; j++) {
          const object = stacked[shape.index][j];
          object.visible = j < count;
          if (!object.visible) continue;
          stackAt.set(
            0,
            tube.bottomY + ITEM.lift + j * shape.pitch + shift,
            tube.z,
          );
          placeItem(object, stackAt);
        }
      }
    },
  };
}
