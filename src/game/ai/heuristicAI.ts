import { BoardSize } from '../constants';
import { makeRandomMove } from './randomAI';

export const makeHeuristicMove = (
  board: number[][],
  currentPlayer: number,
  boardSize: BoardSize,
  isValidMove: (row: number, col: number) => boolean
): { row: number; col: number } | null => {
  // Ưu tiên các điểm sao (star points)
  const getStarPoints = (size: BoardSize): [number, number][] => {
    if (size === 9) return [[2,2], [2,6], [6,2], [6,6], [4,4]];
    if (size === 13) return [[3,3], [3,9], [9,3], [9,9], [6,6]];
    return [[3,3], [3,15], [15,3], [15,15], [9,9]]; // 19x19
  };

  const starPoints = getStarPoints(boardSize);
  for (const [row, col] of starPoints) {
    if (isValidMove(row, col)) {
      return { row, col };
    }
  }

  // Nếu không, dùng random
  return makeRandomMove(board, currentPlayer, boardSize, isValidMove);
};
