export const EMPTY: Player = 0;
export const BLACK: Player = 1;
export const WHITE: Player = 2;
export const STAR_POINTS: Record<BoardSize, [number, number][]> = {
  9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
  13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
  19: [[3, 3], [3, 15], [15, 3], [15, 15], [9, 9]],
};
