import { Player, BoardSize } from '../../types/goTypes';
import { EMPTY, BLACK, WHITE, STAR_POINTS } from '../constants';
import { hasLiberties, isSuicideMove, checkCaptures } from '../rules/goRules';
import { makeRandomMove } from './randomAI';

/**
 * Đánh giá một nước đi dựa trên heuristic đơn giản nhưng hiệu quả
 */
const evaluateMove = (
  board: Player[][],
  row: number,
  col: number,
  player: Player,
  opponent: Player,
  boardSize: BoardSize
): number => {
  let score = 0;

  // 1. Kiểm tra xem nước đi này có bắt được quân không
  const testBoard = board.map(r => [...r]);
  testBoard[row][col] = player;
  const { captures } = checkCaptures(testBoard, row, col, player, boardSize);
  if (captures > 0) {
    score += 100 + captures * 10; // Ưu tiên bắt quân
  }

  // 2. Đếm liberties của nhóm mới tạo thành
  const { hasLiberty, group } = hasLiberties(testBoard, row, col, boardSize);
  if (!hasLiberty) {
    return -Infinity; // Không bao giờ chọn nước tự sát
  }

  const liberties = new Set<string>();
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [gr, gc] of group) {
    for (const [dr, dc] of directions) {
      const nr = gr + dr;
      const nc = gc + dc;
      if (
        nr >= 0 && nr < boardSize &&
        nc >= 0 && nc < boardSize &&
        testBoard[nr][nc] === EMPTY
      ) {
        liberties.add(`${nr},${nc}`);
      }
    }
  }
  score += liberties.size * 5; // Nhiều liberties = an toàn hơn

  // 3. Gần quân đối phương? (tăng tính tấn công)
  let adjacentOpponent = 0;
  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (
      nr >= 0 && nr < boardSize &&
      nc >= 0 && nc < boardSize &&
      board[nr][nc] === opponent
    ) {
      adjacentOpponent++;
    }
  }
  score += adjacentOpponent * 3;

  // 4. Phạt nếu đi vào góc mà không có mục đích
  if (boardSize === 19) {
    const isCorner = (row === 0 || row === boardSize - 1) && (col === 0 || col === boardSize - 1);
    const isEdge = (row === 0 || row === boardSize - 1) || (col === 0 || col === boardSize - 1);
    if (isCorner && adjacentOpponent === 0) {
      score -= 20; // Tránh đi góc vô ích
    } else if (isEdge && adjacentOpponent === 0) {
      score -= 5;
    }
  }

  return score;
};

export const makeHeuristicMove = (
  board: Player[][],
  currentPlayer: Player,
  boardSize: BoardSize,
  isValidMove: (row: number, col: number) => boolean
): { row: number; col: number } | null => {
  const opponent = currentPlayer === BLACK ? WHITE : BLACK;
  const totalStones = board.flat().filter(cell => cell !== EMPTY).length;

  // Giai đoạn đầu game: ưu tiên điểm sao
  if (totalStones < Math.min(8, boardSize)) {
    const starPoints = STAR_POINTS[boardSize];
    for (const [row, col] of starPoints) {
      if (isValidMove(row, col)) {
        return { row, col };
      }
    }
  }

  // Giai đoạn giữa/cuối: đánh giá heuristic
  let bestMove: { row: number; col: number } | null = null;
  let bestScore = -Infinity;

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (isValidMove(row, col)) {
        const score = evaluateMove(board, row, col, currentPlayer, opponent, boardSize);
        if (score > bestScore) {
          bestScore = score;
          bestMove = { row, col };
        }
      }
    }
  }

  // Nếu không tìm được nước đi tốt, quay lại random
  if (bestMove) {
    return bestMove;
  }

  return makeRandomMove(board, currentPlayer, boardSize, isValidMove);
};
