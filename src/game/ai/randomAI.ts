import { BoardSize } from '../constants';

export const makeRandomMove = (
  board: number[][],
  currentPlayer: number,
  boardSize: BoardSize,
  isValidMove: (row: number, col: number) => boolean
): { row: number; col: number } | null => {
  const validMoves: [number, number][] = [];
  
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (isValidMove(row, col)) {
        validMoves.push([row, col]);
      }
    }
  }

  if (validMoves.length === 0) return null;
  const [row, col] = validMoves[Math.floor(Math.random() * validMoves.length)];
  return { row, col };
};
