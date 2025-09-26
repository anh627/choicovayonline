import { Player, BoardSize } from '../../types/goTypes';
import { STAR_POINTS } from '../constants';
import { makeRandomMove } from './randomAI';

export const makeHeuristicMove = (
  board: Player[][],
  currentPlayer: Player,
  boardSize: BoardSize,
  isValidMove: (row: number, col: number) => boolean
): { row: number; col: number } | null => {
  // Ưu tiên điểm sao ở đầu game
  const totalMoves = board.flat().filter(cell => cell !== 0).length;
  if (totalMoves < 10) {
    const starPoints = STAR_POINTS[boardSize];
    for (const [row, col] of starPoints) {
      if (isValidMove(row, col)) {
        return { row, col };
      }
    }
  }

  // Sau đó chọn nước đi có nhiều "liberties" nhất (đơn giản hóa)
  let bestMove: [number, number] | null = null;
  let maxLiberties = -1;

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (isValidMove(row, col)) {
        const testBoard = board.map(r => [...r]);
        testBoard[row][col] = currentPlayer;
        const { hasLiberty, group } = hasLiberties(testBoard, row, col, boardSize);
        if (hasLiberty) {
          // Đếm liberties của nhóm mới
          const liberties = new Set<string>();
          for (const [gr, gc] of group) {
            const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
            for (const [dr,dc] of dirs) {
              const nr = gr + dr;
              const nc = gc + dc;
              if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize && testBoard[nr][nc] === 0) {
                liberties.add(`${nr},${nc}`);
              }
            }
          }
          if (liberties.size > maxLiberties) {
            maxLiberties = liberties.size;
            bestMove = [row, col];
          }
        }
      }
    }
  }

  if (bestMove) return { row: bestMove[0], col: bestMove[1] };
  return makeRandomMove(board, currentPlayer, boardSize, isValidMove);
};

export { makeRandomMove } from './randomAI';
