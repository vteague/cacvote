/**
 * Copyright (C) 2021 VotingWorks
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'assert';
import bindings from 'bindings';

const addon = bindings('lsd') as {
  lsd(image: Float64Array, width: number, height: number): Float64Array;
  LSD_RESULT_DIM: number;
};

/**
 * Pixel values for a line segment. `(x1, y1)` is the point at the start of the
 * line segment, `(x2, y2)` is the point at the end of the line segment, and
 * `width` is the thickness of the line segment.
 */
export interface LineSegment {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  width: number;
}

/**
 * JavaScript wrapper for the C addon `lsd` algorithm.
 */
export function lsd(imageData: ImageData): LineSegment[] {
  const { data, width, height } = imageData;
  const channels = imageData.data.length / imageData.width / imageData.height;

  assert.strictEqual(
    channels,
    1,
    `expected a grayscale image, got a ${channels}-channel image`
  );

  const dst = Float64Array.from(data);
  const result = addon.lsd(dst, width, height);

  assert.strictEqual(
    result.length % addon.LSD_RESULT_DIM,
    0,
    'invalid dimension'
  );

  const segments = Array.from<LineSegment>({
    length: result.length / addon.LSD_RESULT_DIM,
  });

  for (
    let ri = 0, si = 0;
    ri < result.length;
    ri += addon.LSD_RESULT_DIM, si += 1
  ) {
    segments[si] = {
      x1: result[ri],
      y1: result[ri + 1],
      x2: result[ri + 2],
      y2: result[ri + 3],
      width: result[ri + 4],
    };
  }

  return segments;
}
