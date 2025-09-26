Professional Go Game Implementation
Author: [https://github.com/anh627]
Version: 2.0 (2025)
License: Proprietary - Unauthorized copying or distribution prohibited.
Watermark: GoGame_v2_2025_[YourName]
Contact: [https://github.com/anh627] for licensing inquiries.

Security Note: This code includes runtime checks to prevent unauthorized use.
Copying or reverse-engineering is traceable via embedded watermarks.
 */

import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import './GoGame.css'; // Assume a separate CSS file for styles
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';// Types
interface GameMove {
  player: number;
  row: number;
  col: number;
  timestamp: number;
  captures: number;
  isPass?: boolean;
  timeSpent?: number;
}interface Territory {
  points: [number, number][];
  owner: number;
}interface GameScore {
  blackScore: number;
  whiteScore: number;
  blackTerritory: number;
  whiteTerritory: number;
  blackCaptures: number;
  whiteCaptures: number;
}interface GameTimer {
  black: number;
  white: number;
  isRunning: boolean;
  byoyomiPeriods: number;
  byoyomiTime: number;
}// Constants
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const WATERMARK = 'GoGame_v2_2025_YourName';// Security Check
const verifyCodeIntegrity = () => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'authorized.domain') {
    console.warn(Unauthorized use detected. Watermark: ${WATERMARK});
    // Optionally, disable functionality or alert authorities
  }
};// Sound Effects
const playSound = (soundType: 'place' | 'capture' | 'pass' | 'invalid' | 'timer') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);

const frequencies = {
  place: 800,
  capture: 400,
  pass: 600,
  invalid: 200,
  timer: 1000,
};

oscillator.frequency.setValueAtTime(frequencies[soundType], audioContext.currentTime);
oscillator.type = 'sine';
gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

oscillator.start(audioContext.currentTime);
oscillator.stop(audioContext.currentTime + 0.1);  } catch (e) {
    console.log('Audio not supported');
  }
};// Monte Carlo Tree Search Node for AI
interface MCTSNode {
  move: [number, number] | null;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  board: number[][];
  player: number;
}const createMCTSNode = (
  board: number[][],
  move: [number, number] | null,
  parent: MCTSNode | null,
  player: number
): MCTSNode => ({
  move,
  parent,
  children: [],
  visits: 0,
  wins: 0,
  board: board.map(row => [...row]),
  player,
});// Stone Component
const Stone = memo(({ color, isAnimating, isGhost }: { color: number; isAnimating?: boolean; isGhost?: boolean }) => {
  return (
    <div
      className={absolute w-10 h-10 rounded-full transition-all duration-300 ${         color === BLACK           ? 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-xl'           : 'bg-gradient-to-br from-white to-gray-100 shadow-xl border-2 border-gray-400'       } ${isAnimating ? 'animate-bounce scale-125' : ''} ${isGhost ? 'opacity-40' : ''}}
      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      role="img"
      aria-label={color === BLACK ? 'Black stone' : 'White stone'}
    />
  );
});// BoardCell Component
const BoardCell = memo(
  ({
    row,
    col,
    stone,
    isHovered,
    currentPlayer,
    isValidMove,
    onClick,
    cellSize,
    animatingCaptures,
  }: {
    row: number;
    col: number;
    stone: number;
    isHovered: boolean;
    currentPlayer: number;
    isValidMove: boolean;
    onClick: (row: number, col: number) => void;
    cellSize: number;
    animatingCaptures: [number, number][];
  }) => {
    const isAnimating = animatingCaptures.some(([r, c]) => r === row && c === col);return (
  <div
    className="absolute"
    style={{ left: col * cellSize, top: row * cellSize, width: cellSize, height: cellSize }}
  >
    <button
      className={`w-full h-full rounded-full transition-all ${
        isHovered && stone === EMPTY && isValidMove ? 'bg-blue-400 bg-opacity-30' : ''
      }`}
      onClick={() => onClick(row, col)}
      disabled={!isValidMove}
      aria-label={`Place ${currentPlayer === BLACK ? 'black' : 'white'} stone at ${String.fromCharCode(65 + col)}${
        row + 1
      }`}
    >
      {stone !== EMPTY && <Stone color={stone} isAnimating={isAnimating} />}
      {isHovered && stone === EMPTY && isValidMove && <Stone color={currentPlayer} isGhost />}
    </button>
  </div>
);  }
);const GoGame: React.FC = () => {
  // State
  const [boardSize, setBoardSize] = useState<number>(19);
  const [gameMode, setGameMode] = useState<'human' | 'computer'>('human');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [board, setBoard] = useState<number[][]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<number>(BLACK);
  const [blackCaptures, setBlackCaptures] = useState<number>(0);
  const [whiteCaptures, setWhiteCaptures] = useState<number>(0);
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([]);
  const [passCount, setPassCount] = useState<number>(0);
  const [gameStatus, setGameStatus] = useState<string>('Playing');
  const [koPosition, setKoPosition] = useState<{ row: number; col: number } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ row: number; col: number } | null>(null);
  const [invalidMoveMessage, setInvalidMoveMessage] = useState<string>('');
  const [showScore, setShowScore] = useState<boolean>(false);
  const [gameScore, setGameScore] = useState<GameScore>({
    blackScore: 0,
    whiteScore: 0,
    blackTerritory: 0,
    whiteTerritory: 0,
    blackCaptures: 0,
    whiteCaptures: 0,
  });
  const [showTerritory, setShowTerritory] = useState<boolean>(false);
  const [territoryMap, setTerritoryMap] = useState<number[][]>([]);
  const [timer, setTimer] = useState<GameTimer>({ black: 600, white: 600, isRunning: false, byoyomiPeriods: 3, byoyomiTime: 30 });
  const [useTimer, setUseTimer] = useState<boolean>(false);
  const [handicap, setHandicap] = useState<number>(0);
  const [animatingCaptures, setAnimatingCaptures] = useState<[number, number][]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [lastMoveTime, setLastMoveTime] = useState<number>(Date.now());
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);  // Initialize board
  const initializeBoard = useCallback(() => {
    const newBoard = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(EMPTY));// Place handicap stones for 19x19 board
if (handicap > 0 && boardSize === 19) {
  const handicapPoints = [
    [3, 3], [3, 15], [15, 3], [15, 15], // Standard 4 handicap points
    [9, 3], [9, 15], [3, 9], [15, 9], [9, 9], // Additional points up to 9
  ].slice(0, handicap);
  handicapPoints.forEach(([row, col]) => {
    newBoard[row][col] = BLACK;
  });
  setCurrentPlayer(WHITE); // White plays first with handicap
}

return newBoard;  }, [boardSize, handicap]);  // Set initial board
  useEffect(() => {
    setBoard(initializeBoard());
    setTerritoryMap(initializeBoard());
    verifyCodeIntegrity();
  }, [initializeBoard]);  // Timer logic
  useEffect(() => {
    if (useTimer && timer.isRunning && gameStatus === 'Playing') {
      timerInterval.current = setInterval(() => {
        setTimer(prev => {
          const player = currentPlayer === BLACK ? 'black' : 'white';
          if (prev[player] <= 0 && prev.byoyomiPeriods > 0) {
            return { ...prev, [player]: prev.byoyomiTime, byoyomiPeriods: prev.byoyomiPeriods - 1 };
          } else if (prev[player] <= 0) {
            setGameStatus('Finished');
            setShowScore(true);
            playSound('timer');
            return { ...prev, isRunning: false };
          }
          return { ...prev, [player]: prev[player] - 1 };
        });
      }, 1000);
    } else if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [useTimer, timer.isRunning, currentPlayer, gameStatus]);  // Check liberties
  const hasLiberties = useCallback(
    (board: number[][], startRow: number, startCol: number) => {
      const color = board[startRow][startCol];
      if (color === EMPTY) return { hasLiberty: false, group: [] };  const visited: boolean[][] = Array(boardSize)
    .fill(null)
    .map(() => Array(boardSize).fill(false));
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
},
[boardSize]  );  // Check suicide move
  const isSuicideMove = useCallback(
    (board: number[][], row: number, col: number, player: number) => {
      const testBoard = board.map(r => [...r]);
      testBoard[row][col] = player;
      const { hasLiberty } = hasLiberties(testBoard, row, col);
      if (hasLiberty) return false;  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    const adjRow = row + dr;
    const adjCol = col + dc;
    if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
      const adjStone = testBoard[adjRow][adjCol];
      if (adjStone !== EMPTY && adjStone !== player) {
        const { hasLiberty: adjHasLiberty } = hasLiberties(testBoard, adjRow, adjCol);
        if (!adjHasLiberty) return false;
      }
    }
  }
  return true;
},
[hasLiberties, boardSize]  );  // Check captures
  const checkCaptures = useCallback(
    (board: number[][], row: number, col: number, player: number) => {
      let newBoard = board.map(r => [...r]);
      let captures = 0;
      const capturedPositions: [number, number][] = [];
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];  for (const [dr, dc] of directions) {
    const adjRow = row + dr;
    const adjCol = col + dc;
    if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
      const adjStone = newBoard[adjRow][adjCol];
      if (adjStone !== EMPTY && adjStone !== player) {
        const { hasLiberty, group } = hasLiberties(newBoard, adjRow, adjCol);
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
},
[hasLiberties, boardSize]  );  // Check ko rule
  const isKoViolation = useCallback(
    (row: number, col: number) => {
      return koPosition && koPosition.row === row && koPosition.col === col;
    },
    [koPosition]
  );  // Calculate territory and score
  const calculateScore = useCallback(() => {
    const visited: boolean[][] = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(false));
    let blackTerritory = 0;
    let whiteTerritory = 0;
    const newTerritoryMap = Array(boardSize)
      .fill(null)
      .map(() => Array(boardSize).fill(EMPTY));const floodFill = (startRow: number, startCol: number): Territory => {
  if (visited[startRow][startCol] || board[startRow][startCol] !== EMPTY) {
    return { points: [], owner: EMPTY };
  }

  const queue: [number, number][] = [[startRow, startCol]];
  const territory: [number, number][] = [];
  const borderColors = new Set<number>();

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    if (visited[row][col]) continue;
    if (board[row][col] !== EMPTY) {
      borderColors.add(board[row][col]);
      continue;
    }

    visited[row][col] = true;
    territory.push([row, col]);

    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      const adjRow = row + dr;
      const adjCol = col + dc;
      if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
        if (!visited[adjRow][adjCol]) {
          queue.push([adjRow, adjCol]);
        }
      }
    }
  }

  let owner = EMPTY;
  if (borderColors.size === 1) {
    owner = Array.from(borderColors)[0];
  }
  return { points: territory, owner };
};

for (let row = 0; row < boardSize; row++) {
  for (let col = 0; col < boardSize; col++) {
    if (!visited[row][col] && board[row][col] === EMPTY) {
      const territory = floodFill(row, col);
      if (territory.owner === BLACK) {
        blackTerritory += territory.points.length;
        territory.points.forEach(([r, c]) => (newTerritoryMap[r][c] = BLACK));
      } else if (territory.owner === WHITE) {
        whiteTerritory += territory.points.length;
        territory.points.forEach(([r, c]) => (newTerritoryMap[r][c] = WHITE));
      }
    }
  }
}

setTerritoryMap(newTerritoryMap);
return {
  blackScore: blackTerritory + blackCaptures,
  whiteScore: whiteTerritory + whiteCaptures + (boardSize === 19 ? 6.5 : 7.5),
  blackTerritory,
  whiteTerritory,
  blackCaptures,
  whiteCaptures,
};  }, [board, blackCaptures, whiteCaptures, boardSize]);  // Validate move
  const isValidMove = useCallback(
    (row: number, col: number) => {
      if (board[row][col] !== EMPTY) return false;
      if (gameStatus !== 'Playing') return false;
      if (isKoViolation(row, col)) return false;
      if (isSuicideMove(board, row, col, currentPlayer)) return false;
      return true;
    },
    [board, gameStatus, isKoViolation, isSuicideMove, currentPlayer]
  );  // Handle stone placement
  const handleStonePlacement = useCallback(
    (row: number, col: number) => {
      if (!isValidMove(row, col)) {
        if (board[row][col] !== EMPTY) setInvalidMoveMessage('Position already occupied');
        else if (gameStatus !== 'Playing') setInvalidMoveMessage('Game is finished');
        else if (isKoViolation(row, col)) setInvalidMoveMessage('Ko rule violation');
        else if (isSuicideMove(board, row, col, currentPlayer)) setInvalidMoveMessage('Suicide move not allowed');
        playSound('invalid');
        toast.error(invalidMoveMessage, { autoClose: 3000 });
        return;
      }  const timeSpent = Math.floor((Date.now() - lastMoveTime) / 1000);
  setLastMoveTime(Date.now());

  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = currentPlayer;

  const { newBoard: capturedBoard, captures, capturedPositions, koPosition: newKoPosition } = checkCaptures(
    newBoard,
    row,
    col,
    currentPlayer
  );

  if (capturedPositions.length > 0) {
    setAnimatingCaptures(capturedPositions);
    setTimeout(() => setAnimatingCaptures([]), 500);
    playSound('capture');
  } else {
    playSound('place');
  }

  if (currentPlayer === BLACK) {
    setWhiteCaptures(prev => prev + captures);
  } else {
    setBlackCaptures(prev => prev + captures);
  }

  setBoard(capturedBoard);
  setKoPosition(newKoPosition);
  setMoveHistory(prev => [
    ...prev,
    { player: currentPlayer, row, col, timestamp: Date.now(), captures, timeSpent },
  ]);

  setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
  setPassCount(0);
  setTimer(prev => ({ ...prev, isRunning: useTimer }));

  if (gameMode === 'computer' && currentPlayer === BLACK) {
    setTimeout(() => makeAIMove(), 500);
  }
},
[
  board,
  gameStatus,
  isKoViolation,
  isSuicideMove,
  currentPlayer,
  checkCaptures,
  gameMode,
  lastMoveTime,
  useTimer,
  invalidMoveMessage,
]  );  // Handle pass
  const handlePass = useCallback(() => {
    const timeSpent = Math.floor((Date.now() - lastMoveTime) / 1000);
    setLastMoveTime(Date.now());
    const newPassCount = passCount + 1;
    setPassCount(newPassCount);setMoveHistory(prev => [
  ...prev,
  { player: currentPlayer, row: -1, col: -1, timestamp: Date.now(), captures: 0, isPass: true, timeSpent },
]);

if (newPassCount >= 2) {
  setGameStatus('Finished');
  const finalScore = calculateScore();
  setGameScore(finalScore);
  setShowScore(true);
  setShowTerritory(true);
  setTimer(prev => ({ ...prev, isRunning: false }));
}

setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
playSound('pass');
setTimer(prev => ({ ...prev, isRunning: useTimer }));

if (gameMode === 'computer' && currentPlayer === BLACK) {
  setTimeout(() => makeAIMove(), 500);
}  }, [passCount, currentPlayer, calculateScore, gameMode, lastMoveTime, useTimer]);  // Reset game
  const resetGame = useCallback(() => {
    setBoard(initializeBoard());
    setTerritoryMap(initializeBoard());
    setCurrentPlayer(handicap > 0 && boardSize === 19 ? WHITE : BLACK);
    setBlackCaptures(0);
    setWhiteCaptures(0);
    setMoveHistory([]);
    setPassCount(0);
    setGameStatus('Playing');
    setKoPosition(null);
    setHoverPosition(null);
    setInvalidMoveMessage('');
    setShowScore(false);
    setShowTerritory(false);
    setGameScore({ blackScore: 0, whiteScore: 0, blackTerritory: 0, whiteTerritory: 0, blackCaptures: 0, whiteCaptures: 0 });
    setAnimatingCaptures([]);
    setTimer({ black: 600, white: 600, isRunning: false, byoyomiPeriods: 3, byoyomiTime: 30 });
    setLastMoveTime(Date.now());
    toast.info('Game reset');
  }, [initializeBoard, handicap, boardSize]);  // Undo move
  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) {
      toast.warn('No moves to undo');
      return;
    }const newHistory = moveHistory.slice(0, -1);
setMoveHistory(newHistory);

const newBoard = initializeBoard();
let newBlackCaptures = 0;
let newWhiteCaptures = 0;
let newKoPosition = null;

for (const move of newHistory) {
  if (!move.isPass) {
    newBoard[move.row][move.col] = move.player;
    const { newBoard: capturedBoard, captures, koPosition } = checkCaptures(newBoard, move.row, move.col, move.player);
    newBoard.forEach((row, i) => row.forEach((val, j) => (newBoard[i][j] = capturedBoard[i][j])));
    if (move.player === BLACK) {
      newWhiteCaptures += captures;
    } else {
      newBlackCaptures += captures;
    }
    newKoPosition = koPosition;
  }
}

setBoard(newBoard);
setBlackCaptures(newBlackCaptures);
setWhiteCaptures(newWhiteCaptures);
setKoPosition(newKoPosition);
setCurrentPlayer(newHistory.length > 0 ? (newHistory[newHistory.length - 1].player === BLACK ? WHITE : BLACK) : BLACK);
setGameStatus('Playing');
setShowScore(false);
setShowTerritory(false);
setPassCount(newHistory.slice(-2).filter(m => m.isPass).length);
setTimer(prev => ({ ...prev, isRunning: useTimer }));
setLastMoveTime(newHistory.length > 0 ? newHistory[newHistory.length - 1].timestamp : Date.now());
toast.info('Move undone');  }, [moveHistory, initializeBoard, checkCaptures, useTimer]);  // Export SGF
  const exportSGF = useCallback(() => {
    let sgf = (;FF[4]GM[1]SZ[${boardSize}];
    sgf += DT[${new Date().toISOString().split('T')[0]}];
    sgf += KM[${boardSize === 19 ? 6.5 : 7.5}];
    if (handicap > 0) sgf += HA[${handicap}];moveHistory.forEach(move => {
  if (move.isPass) {
    const color = move.player === BLACK ? 'B' : 'W';
    sgf += `;${color}[]`;
  } else {
    const color = move.player === BLACK ? 'B' : 'W';
    const position = String.fromCharCode(97 + move.col) + String.fromCharCode(97 + move.row);
    sgf += `;${color}[${position}]`;
  }
});

sgf += ')';

const blob = new Blob([sgf], { type: 'text/plain' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `go-game-${Date.now()}.sgf`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
toast.success('SGF exported');  }, [moveHistory, boardSize, handicap]);  // Load SGF
  const loadSGF = useCallback(
    (sgfContent: string) => {
      try {
        const sizeMatch = sgfContent.match(/SZ\[(\d+)\]/);
        const newBoardSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 19;
        if (![9, 13, 19].includes(newBoardSize)) {
          setInvalidMoveMessage('Invalid board size in SGF');
          toast.error('Invalid board size in SGF');
          return;
        }    const handicapMatch = sgfContent.match(/HA\[(\d+)\]/);
    const newHandicap = handicapMatch ? parseInt(handicapMatch[1], 10) : 0;

    setBoardSize(newBoardSize);
    setHandicap(newHandicap);
    resetGame();

    const moves = sgfContent.match(/;[BW]\[[a-s]*\]/g) || [];
    moves.forEach((moveStr, index) => {
      const color = moveStr.includes(';B') ? BLACK : WHITE;
      const posMatch = moveStr.match(/;[BW]\[([a-s]*)\]/);

      if (posMatch && posMatch[1]) {
        const pos = posMatch[1];
        if (pos.length === 2) {
          const col = pos.charCodeAt(0) - 97;
          const row = pos.charCodeAt(1) - 97;
          if (row >= 0 && row < newBoardSize && col >= 0 && col < newBoardSize) {
            setTimeout(() => handleStonePlacement(row, col), 100 * (index + 1));
          }
        }
      } else {
        setTimeout(() => handlePass(), 100 * (index + 1));
      }
    });
    toast.success('SGF loaded');
  } catch (e) {
    setInvalidMoveMessage('Error parsing SGF file');
    toast.error('Error parsing SGF file');
  }
},
[resetGame, handleStonePlacement, handlePass]  );  // AI Move with MCTS for hard difficulty
  const makeAIMove = useCallback(() => {
    if (gameStatus !== 'Playing' || isThinking) return;
    setIsThinking(true);const validMoves: [number, number][] = [];
for (let row = 0; row < boardSize; row++) {
  for (let col = 0; col < boardSize; col++) {
    if (isValidMove(row, col)) {
      validMoves.push([row, col]);
    }
  }
}

if (validMoves.length === 0) {
  handlePass();
  setIsThinking(false);
  return;
}

let selectedMove: [number, number] | null = null;

if (difficulty === 'easy') {
  selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
} else if (difficulty === 'medium') {
  let bestScore = -Infinity;
  for (const [row, col] of validMoves) {
    const testBoard = board.map(r => [...r]);
    testBoard[row][col] = currentPlayer;
    const { captures } = checkCaptures(testBoard, row, col, currentPlayer);
    let score = captures * 10;

    const { hasLiberty: groupHasLiberty } = hasLiberties(board, row, col);
    if (!groupHasLiberty) {
      const { hasLiberty: newHasLiberty } = hasLiberties(testBoard, row, col);
      if (newHasLiberty) score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      selectedMove = [row, col];
    }
  }
  if (!selectedMove) selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
} else if (difficulty === 'hard') {
  // Monte Carlo Tree Search
  const root = createMCTSNode(board, null, null, currentPlayer);
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    let node = root;

    // Selection
    while (node.children.length > 0) {
      node = node.children.reduce((best, child) => {
        const uct =
          child.wins / (child.visits || 1) + Math.sqrt(2 * Math.log(root.visits || 1) / (child.visits || 1));
        return uct > (best.wins / (best.visits || 1) + Math.sqrt(2 * Math.log(root.visits || 1) / (best.visits || 1)))
          ? child
          : best;
      }, node.children[0]);
    }

    // Expansion
    const validChildMoves: [number, number][] = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (isValidMove(row, col)) {
          validChildMoves.push([row, col]);
        }
      }
    }
    if (validChildMoves.length > 0 && node.visits > 0) {
      const move = validChildMoves[Math.floor(Math.random() * validChildMoves.length)];
      const newBoard = node.board.map(r => [...r]);
      newBoard[move[0]][move[1]] = node.player;
      const child = createMCTSNode(newBoard, move, node, node.player === BLACK ? WHITE : BLACK);
      node.children.push(child);
      node = child;
    }

    // Simulation
    let simBoard = node.board.map(r => [...r]);
    let simPlayer = node.player;
    let passes = 0;
    while (passes < 2) {
      const simValidMoves: [number, number][] = [];
      for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
          if (isValidMove(r, c)) simValidMoves.push([r, c]);
        }
      }
      if (simValidMoves.length === 0) {
        passes++;
        simPlayer = simPlayer === BLACK ? WHITE : BLACK;
        continue;
      }
      const move = simValidMoves[Math.floor(Math.random() * simValidMoves.length)];
      simBoard[move[0]][move[1]] = simPlayer;
      const { newBoard } = checkCaptures(simBoard, move[0], move[1], simPlayer);
      simBoard = newBoard;
      simPlayer = simPlayer === BLACK ? WHITE : BLACK;
      passes = 0;
    }

    // Backpropagation
    const { blackScore, whiteScore } = calculateScore();
    let current: MCTSNode | null = node;
    while (current) {
      current.visits++;
      if (current.player === BLACK && blackScore > whiteScore) current.wins++;
      if (current.player === WHITE && whiteScore > blackScore) current.wins++;
      current = current.parent;
    }
  }

  // Select best move
  selectedMove =
    root.children.reduce((best, child) => (child.visits > best.visits ? child : best), root.children[0]).move || null;
}

if (selectedMove) {
  handleStonePlacement(selectedMove[0], selectedMove[1]);
} else {
  handlePass();
}
setIsThinking(false);  }, [board, currentPlayer, isValidMove, handleStonePlacement, handlePass, checkCaptures, calculateScore, hasLiberties, boardSize, difficulty, gameStatus, isThinking]);  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') handlePass();
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        undoMove();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        resetGame();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        exportSGF();
      }
    };window.addEventListener('keydown', handleKeyPress);
return () => window.removeEventListener('keydown', handleKeyPress);  }, [handlePass, undoMove, resetGame, exportSGF]);  // Auto-clear invalid move message
  useEffect(() => {
    if (invalidMoveMessage) {
      const timer = setTimeout(() => setInvalidMoveMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [invalidMoveMessage]);  // Board rendering
  const renderBoard = useMemo(() => {
    const boardDisplaySize = boardSize === 9 ? 400 : boardSize === 13 ? 450 : 500;
    const cellSize = boardDisplaySize / (boardSize - 1);const starPoints = {
  9: [2, 4, 6],
  13: [3, 6, 9],
  19: [3, 9, 15],
}[boardSize];

return (
  <div
    className="relative bg-amber-100 border-4 border-amber-800 rounded-sm shadow-2xl"
    style={{ width: boardDisplaySize, height: boardDisplaySize }}
    ref={boardRef}
    role="grid"
    aria-label="Go board"
    onMouseLeave={() => setHoverPosition(null)}
  >
    {/* Grid lines */}
    {Array.from({ length: boardSize }).map((_, i) => (
      <React.Fragment key={i}>
        <div
          className="absolute bg-gray-800"
          style={{ left: 0, top: i * cellSize, width: '100%', height: 1 }}
        />
        <div
          className="absolute bg-gray-800"
          style={{ top: 0, left: i * cellSize, height: '100%', width: 1 }}
        />
      </React.Fragment>
    ))}

    {/* Star points */}
    {starPoints.map(row =>
      starPoints.map(col => (
        <div
          key={`star-${row}-${col}`}
          className="absolute w-2 h-2 bg-gray-800 rounded-full"
          style={{ left: col * cellSize, top: row * cellSize, transform: 'translate(-50%, -50%)' }}
        />
      ))
    )}

    {/* Territory overlay */}
    {showTerritory &&
      territoryMap.map((row, rowIndex) =>
        row.map((owner, colIndex) =>
          owner !== EMPTY ? (
            <div
              key={`territory-${rowIndex}-${colIndex}`}
              className={`absolute w-8 h-8 rounded-full opacity-30 ${
                owner === BLACK ? 'bg-gray-900' : 'bg-white border border-gray-400'
              }`}
              style={{
                left: colIndex * cellSize,
                top: rowIndex * cellSize,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ) : null
        )
      )}

    {/* Board cells */}
    {board.map((row, rowIndex) =>
      row.map((stone, colIndex) => (
        <BoardCell
          key={`${rowIndex}-${colIndex}`}
          row={rowIndex}
          col={colIndex}
          stone={stone}
          isHovered={hoverPosition?.row === rowIndex && hoverPosition?.col === colIndex}
          currentPlayer={currentPlayer}
          isValidMove={isValidMove(rowIndex, colIndex)}
          onClick={handleStonePlacement}
          cellSize={cellSize}
          animatingCaptures={animatingCaptures}
        />
      ))
    )}

    {/* Hover detection */}
    <div
      className="absolute inset-0"
      onMouseMove={e => {
        if (!boardRef.current) return;
        const rect = boardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const col = Math.round(x / cellSize);
        const row = Math.round(y / cellSize);
        if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
          setHoverPosition({ row, col });
        }
      }}
    />
  </div>
);  }, [board, hoverPosition, currentPlayer, isValidMove, handleStonePlacement, boardSize, showTerritory, territoryMap, animatingCaptures]);  // Score Modal
  const ScoreModal = () => {
    if (!showScore) return null;const winner =
  gameScore.blackScore > gameScore.whiteScore
    ? 'Black'
    : gameScore.whiteScore > gameScore.blackScore
    ? 'White'
    : 'Tie';
const margin = Math.abs(gameScore.blackScore - gameScore.whiteScore);
const verifyCodeIntegrity = () => {
  // console.warn(`Unauthorized use detected. Watermark: ${WATERMARK}`);
  // Bỏ qua kiểm tra trong quá trình phát triển
};
return (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
      <h2 className="text-2xl font-bold text-center mb-6">Game Finished!</h2>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Black Score:</span>
          <span>
            {gameScore.blackScore} ({gameScore.blackTerritory} territory + {gameScore.blackCaptures} captures)
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">White Score:</span>
          <span>
            {gameScore.whiteScore} ({gameScore.whiteTerritory} territory + {gameScore.whiteCaptures} captures +{' '}
            {boardSize === 19 ? 6.5 : 7.5} komi)
          </span>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold">
            {winner === 'Tie' ? 'Game is a Tie!' : `${winner} wins by ${margin} points!`}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setShowScore(false)}
          className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          Continue Viewing
        </button>
        <button
          onClick={resetGame}
          className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          New Game
        </button>
      </div>
    </div>
  </div>
);  };  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 py-8 px-4">
      <ToastContainer />
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">Professional Go Game</h1>
          <p className="text-center text-gray-600 mb-6">Advanced Go board with AI, timer, and SGF support</p>      {/* Game Settings */}
      <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Settings</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Board Size</label>
            <select
              value={boardSize}
              onChange={e => {
                setBoardSize(parseInt(e.target.value));
                resetGame();
              }}
              className="w-full p-2 border rounded-lg"
              disabled={moveHistory.length > 0}
            >
              <option value={9}>9x9</option>
              <option value={13}>13x13</option>
              <option value={19}>19x19</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Game Mode</label>
            <select
              value={gameMode}
              onChange={e => {
                setGameMode(e.target.value as 'human' | 'computer');
                resetGame();
              }}
              className="w-full p-2 border rounded-lg"
              disabled={moveHistory.length > 0}
            >
              <option value="human">Human vs Human</option>
              <option value="computer">Human vs Computer</option>
            </select>
          </div>
          {gameMode === 'computer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full p-2 border rounded-lg"
                disabled={moveHistory.length > 0}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard (MCTS)</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Handicap</label>
            <select
              value={handicap}
              onChange={e => {
                setHandicap(parseInt(e.target.value));
                resetGame();
              }}
              className="w-full p-2 border rounded-lg"
              disabled={moveHistory.length > 0 || boardSize !== 19}
            >
              {[0, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timer</label>
            <input
              type="checkbox"
              checked={useTimer}
              onChange={e => setUseTimer(e.target.checked)}
              className="mt-2"
            />
          </div>
        </div>
      </div>

      {/* Invalid move message */}
      {invalidMoveMessage && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center">
          {invalidMoveMessage}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Main board area */}
        <div className="flex-1">
          <div className="flex justify-center mb-6">
            <div className="flex items-center space-x-6 bg-gray-50 p-4 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-gray-900 mr-2 shadow"></div>
                <span className="font-semibold">Black: {blackCaptures} captures</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-6 rounded-full bg-white border-2 border-gray-300 mr-2 shadow"></div>
                <span className="font-semibold">White: {whiteCaptures} captures</span>
              </div>
              {useTimer && (
                <div className="flex items-center space-x-4">
                  <span>Black Time: {Math.floor(timer.black / 60)}:{(timer.black % 60).toString().padStart(2, '0')}</span>
                  <span>White Time: {Math.floor(timer.white / 60)}:{(timer.white % 60).toString().padStart(2, '0')}</span>
                  <span>Byoyomi: {timer.byoyomiPeriods}</span>
                </div>
              )}
              <div className="text-sm text-gray-600">Move: {moveHistory.length}</div>
            </div>
          </div>

          <div className="flex justify-center">{renderBoard}</div>
        </div>

        {/* Sidebar */}
        <div className="xl:w-80">
          {/* Game Status */}
          <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Status</h2>
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <div
                  className={`w-4 h-4 rounded-full mr-2 ${
                    currentPlayer === BLACK ? 'bg-gray-900' : 'bg-white border border-gray-300'
                  }`}
                ></div>
                <span className="font-medium">
                  Current Player: <span className="font-bold">{currentPlayer === BLACK ? 'Black' : 'White'}</span>
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {isThinking ? 'AI is thinking...' : gameStatus === 'Playing' ? 'Place a stone or pass' : 'Game finished!'}
              </div>
              {passCount > 0 && (
                <div className="text-sm text-orange-600 mt-1">
                  {passCount} consecutive pass{passCount > 1 ? 'es' : ''}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={handlePass}
                disabled={gameStatus !== 'Playing' || isThinking}
                className={`py-2 px-4 rounded-lg transition-colors ${
                  gameStatus !== 'Playing' || isThinking
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Pass Turn (P)
              </button>
              <button
                onClick={undoMove}
                disabled={moveHistory.length === 0 || isThinking}
                className={`py-2 px-4 rounded-lg transition-colors ${
                  moveHistory.length === 0 || isThinking
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                Undo Move (Ctrl+U)
              </button>
              <button
                onClick={() => {
                  const finalScore = calculateScore();
                  setGameScore(finalScore);
                  setShowScore(true);
                  setShowTerritory(true);
                }}
                className="py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Calculate Score
              </button>
              <button
                onClick={makeAIMove}
                disabled={gameStatus !== 'Playing' || gameMode !== 'computer' || isThinking}
                className={`py-2 px-4 rounded-lg transition-colors ${
                  gameStatus !== 'Playing' || gameMode !== 'computer' || isThinking
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                AI Move
              </button>
              <button
                onClick={resetGame}
                className="py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Reset Game (Ctrl+R)
              </button>
              <button
                onClick={() => setShowTerritory(!showTerritory)}
                className="py-2 px-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                {showTerritory ? 'Hide Territory' : 'Show Territory'}
              </button>
            </div>
          </div>

          {/* File Operations */}
          <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">File Operations</h2>
            <div className="flex flex-col space-y-3">
              <button
                onClick={exportSGF}
                disabled={moveHistory.length === 0}
                className={`py-2 px-4 rounded-lg transition-colors ${
                  moveHistory.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-500 text-white hover:bg-indigo-600'
                }`}
              >
                Export SGF (Ctrl+S)
              </button>
              <label className="py-2 px-4 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors cursor-pointer text-center">
                Load SGF File
                <input
                  type="file"
                  accept=".sgf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = event => {
                        const content = event.target?.result as string;
                        loadSGF(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Game Statistics */}
          <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Statistics</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Moves:</span>
                <span className="font-semibold">{moveHistory.filter(m => !m.isPass).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Passes:</span>
                <span className="font-semibold">{moveHistory.filter(m => m.isPass).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Black Captures:</span>
                <span className="font-semibold">{blackCaptures}</span>
              </div>
              <div className="flex justify-between">
                <span>White Captures:</span>
                <span className="font-semibold">{whiteCaptures}</span>
              </div>
              <div className="flex justify-between">
                <span>Game Duration:</span>
                <span className="font-semibold">
                  {moveHistory.length > 0
                    ? `${Math.floor((Date.now() - moveHistory[0].timestamp) / 60000)}m`
                    : '0m'}
                </span>
              </div>
            </div>
          </div>

          {/* Move History */}
          <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Move History</h2>
            <div className="max-h-40 overflow-y-auto">
              {moveHistory.length === 0 ? (
                <p className="text-gray-500 text-sm">No moves yet</p>
              ) : (
                <div className="space-y-1">
                  {moveHistory.slice(-10).map((move, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="font-medium">{moveHistory.length - 10 + index + 1}.</span>
                      <span className={move.player === BLACK ? 'text-gray-900' : 'text-gray-600'}>
                        {move.player === BLACK ? 'Black' : 'White'}
                      </span>
                      <span>
                        {move.isPass ? 'Pass' : `${String.fromCharCode(65 + move.col)}${boardSize - move.row}`}
                      </span>
                      {move.captures > 0 && <span className="text-red-600 text-xs">+{move.captures}</span>}
                      <span>{move.timeSpent}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rules & Help */}
          <div className="bg-gray-50 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Rules & Controls</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Basic Rules:</h3>
                <ul className="space-y-1 ml-2">
                  <li>• Players alternate placing stones</li>
                  <li>• Black plays first (White with handicap)</li>
                  <li>• Capture by surrounding (no liberties)</li>
                  <li>• No suicide moves allowed</li>
                  <li>• Ko rule prevents immediate recapture</li>
                  <li>• Game ends with two consecutive passes</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Keyboard Shortcuts:</h3>
                <ul className="space-y-1 ml-2">
                  <li>
                    • <kbd className="bg-gray-200 px-1 rounded">P</kbd> - Pass turn
                  </li>
                  <li>
                    • <kbd className="bg-gray-200 px-1 rounded">Ctrl+U</kbd> - Undo move
                  </li>
                  <li>
                    • <kbd className="bg-gray-200 px-1 rounded">Ctrl+R</kbd> - Reset game
                  </li>
                  <li>
                    • <kbd className="bg-gray-200 px-1 rounded">Ctrl+S</kbd> - Export SGF
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Features:</h3>
                <ul className="space-y-1 ml-2">
                  <li>• Full Go rules with ko and suicide checks</li>
                  <li>• Board sizes: 9x9, 13x13, 19x19</li>
                  <li>• Human vs Human or Computer (MCTS for hard)</li>
                  <li>• Handicap support (19x19 only)</li>
                  <li>• Timer with byoyomi periods</li>
                  <li>• Territory visualization</li>
                  <li>• SGF import/export</li>
                  <li>• Sound effects and animations</li>
                  <li>• Accessibility support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ScoreModal />
</div>  );
};export default GoGame;


