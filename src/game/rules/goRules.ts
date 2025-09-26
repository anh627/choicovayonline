import { Player, BoardSize } from '../../types/goTypes';
import { EMPTY } from '../constants';

export const hasLiberties = (
  board: Player[][],
  startRow: number,
  startCol: number,
  boardSize: BoardSize
) => {
  const color = board[startRow][startCol];
  if (color === EMPTY) return { hasLiberty: false, group: [] };

  const visited: boolean[][] = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false));
  const group: [number, number][] = [];
  const queue: [number, number][] = [[startRow, startCol]];
  let hasLiberty = false;

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    if (visited[row][col]) continue;
    visited[row][col] = true;
    group.push([row, col]);

    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
        if (board[nr][nc] === EMPTY) {
          hasLiberty = true;
        } else if (board[nr][nc] === color && !visited[nr][nc]) {
          queue.push([nr, nc]);
        }
      }
    }
  }

  return { hasLiberty, group };
};

export const isSuicideMove = (
  board: Player[][],
  row: number,
  col: number,
  player: Player,
  boardSize: BoardSize
): boolean => {
  const testBoard = board.map(r => [...r]);
  testBoard[row][col] = player;

  const { hasLiberty } = hasLiberties(testBoard, row, col, boardSize);
  if (hasLiberty) return false;

  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
      const adj = testBoard[nr][nc];
      if (adj !== EMPTY && adj !== player) {
        const { hasLiberty: adjHasLiberty } = hasLiberties(testBoard, nr, nc, boardSize);
        if (!adjHasLiberty) return false;
      }
    }
  }

  return true;
};

export const checkCaptures = (
  board: Player[][],
  row: number,
  col: number,
  player: Player,
  boardSize: BoardSize
) => {
  let newBoard = board.map(r => [...r]);
  let captures = 0;
  const capturedPositions: [number, number][] = [];

  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
      const adj = newBoard[nr][nc];
      if (adj !== EMPTY && adj !== player) {
        const { hasLiberty, group } = hasLiberties(newBoard, nr, nc, boardSize);
        if (!hasLiberty) {
          for (const [gr, gc] of group) {
            newBoard[gr][gc] = EMPTY;
            capturedPositions.push([gr, gc]);
            captures++;
          }
        }
      }
    }
  }

  const koPosition = captures === 1 ? { row: capturedPositions[0][0], col: capturedPositions[0][1] } : null;
  return { newBoard, captures, capturedPositions, koPosition };
};

export const isKoViolation = (
  koPosition: { row: number; col: number } | null,
  row: number,
  col: number
): boolean => {
  return !!koPosition && koPosition.row === row && koPosition.col === col;
};
