import { BoardSize, EMPTY, BLACK, WHITE } from '../constants';

export const hasLiberties = (board: number[][], startRow: number, startCol: number, boardSize: BoardSize) => {
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
      const adjRow = row + dr;
      const adjCol = col + dc;
      
      if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
        if (board[adjRow][adjCol] === EMPTY) {
          hasLiberty = true;
        } else if (board[adjRow][adjCol] === color && !visited[adjRow][adjCol]) {
          queue.push([adjRow, adjCol]);
        }
      }
    }
  }
  
  return { hasLiberty, group };
};

export const isSuicideMove = (board: number[][], row: number, col: number, player: number, boardSize: BoardSize) => {
  const testBoard = board.map(r => [...r]);
  testBoard[row][col] = player;
  
  const { hasLiberty } = hasLiberties(testBoard, row, col, boardSize);
  if (hasLiberty) return false;
  
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    const adjRow = row + dr;
    const adjCol = col + dc;
    if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
      const adjStone = testBoard[adjRow][adjCol];
      if (adjStone !== EMPTY && adjStone !== player) {
        const { hasLiberty: adjHasLiberty } = hasLiberties(testBoard, adjRow, adjCol, boardSize);
        if (!adjHasLiberty) return false;
      }
    }
  }
  
  return true;
};

export const checkCaptures = (board: number[][], row: number, col: number, player: number, boardSize: BoardSize) => {
  let newBoard = board.map(r => [...r]);
  let captures = 0;
  const capturedPositions: [number, number][] = [];
  
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dr, dc] of directions) {
    const adjRow = row + dr;
    const adjCol = col + dc;
    
    if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
      const adjStone = newBoard[adjRow][adjCol];
      
      if (adjStone !== EMPTY && adjStone !== player) {
        const { hasLiberty, group } = hasLiberties(newBoard, adjRow, adjCol, boardSize);
        
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
  
  const newKoPosition = captures === 1 ? { row: capturedPositions[0][0], col: capturedPositions[0][1] } : null;
  return { newBoard, captures, capturedPositions, koPosition: newKoPosition };
};

export const isKoViolation = (koPosition: {row: number, col: number} | null, row: number, col: number) => {
  return koPosition && koPosition.row === row && koPosition.col === col;
};
