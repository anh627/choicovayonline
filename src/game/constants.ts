export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const BOARD_SIZES = [9, 13, 19] as const;
export type BoardSize = typeof BOARD_SIZES[number];
