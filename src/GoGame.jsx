import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ---- Types & Constants ----
type Stone = 0 | 1 | 2; // 0 empty, 1 black, 2 white
type GameMode = 'ai' | 'local' | 'online';
type Difficulty = 'easy' | 'medium' | 'hard';
type GameStatus = 'playing' | 'finished' | 'paused';

interface Position {
  x: number;
  y: number;
}

interface GameMove {
  player: Stone;
  position: Position;
  timestamp: number;
  captures: number;
  isPass?: boolean;
  boardState: Stone[][];
}

interface Captures {
  black: number;
  white: number;
}

interface GameScore {
  blackScore: number;
  whiteScore: number;
  blackTerritory: number;
  whiteTerritory: number;
  komi: number;
  winner: 'black' | 'white' | 'draw';
}

interface GameSettings {
  boardSize: number;
  komi: number;
  handicap: number;
  difficulty: Difficulty;
  timePerMove: number;
}

interface TimerState {
  black: number;
  white: number;
  isRunning: boolean;
}

// Constants
const BOARD_SIZES = [9, 13, 19] as const;
const DEFAULT_SETTINGS: GameSettings = {
  boardSize: 9,
  komi: 6.5,
  handicap: 0,
  difficulty: 'medium',
  timePerMove: 30
};

const STAR_POINTS = {
  9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
  13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
  19: [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]]
};

// ---- Utility Functions ----
function makeEmptyBoard(size: number): Stone[][] {
  return Array.from({ length: size }, () => Array<Stone>(size).fill(0));
}

function cloneBoard(board: Stone[][]): Stone[][] {
  return board.map(row => [...row]);
}

function inBounds(x: number, y: number, size: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

function getNeighbors(x: number, y: number, size: number): Position[] {
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return directions
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter(pos => inBounds(pos.x, pos.y, size));
}

function getGroupAndLiberties(board: Stone[][], x: number, y: number): { group: Position[]; liberties: Set<string> } {
  const size = board.length;
  const color = board[y][x];
  if (color === 0) return { group: [], liberties: new Set() };

  const visited = new Set<string>();
  const liberties = new Set<string>();
  const group: Position[] = [];
  const key = (px: number, py: number) => `${px},${py}`;

  const stack: Position[] = [{ x, y }];
  visited.add(key(x, y));

  while (stack.length > 0) {
    const current = stack.pop()!;
    group.push(current);

    for (const neighbor of getNeighbors(current.x, current.y, size)) {
      const neighborColor = board[neighbor.y][neighbor.x];
      if (neighborColor === 0) {
        liberties.add(key(neighbor.x, neighbor.y));
      } else if (neighborColor === color && !visited.has(key(neighbor.x, neighbor.y))) {
        visited.add(key(neighbor.x, neighbor.y));
        stack.push(neighbor);
      }
    }
  }

  return { group, liberties };
}

function tryPlay(board: Stone[][], x: number, y: number, color: Stone): { 
  legal: boolean; 
  board?: Stone[][]; 
  captures?: number;
  capturedPositions?: Position[];
} {
  const size = board.length;
  
  // Check if position is empty
  if (board[y][x] !== 0) return { legal: false };
  
  // Check for basic suicide
  const testBoard = cloneBoard(board);
  testBoard[y][x] = color;
  
  const opponent: Stone = color === 1 ? 2 : 1;
  let totalCaptures = 0;
  const capturedPositions: Position[] = [];

  // Check for opponent captures
  for (const neighbor of getNeighbors(x, y, size)) {
    if (testBoard[neighbor.y][neighbor.x] === opponent) {
      const { liberties } = getGroupAndLiberties(testBoard, neighbor.x, neighbor.y);
      if (liberties.size === 0) {
        const { group } = getGroupAndLiberties(testBoard, neighbor.x, neighbor.y);
        totalCaptures += group.length;
        group.forEach(pos => {
          testBoard[pos.y][pos.x] = 0;
          capturedPositions.push(pos);
        });
      }
    }
  }

  // Check if move is suicide
  const { liberties } = getGroupAndLiberties(testBoard, x, y);
  if (liberties.size === 0 && totalCaptures === 0) {
    return { legal: false };
  }

  // Simple ko rule (prevent immediate recapture of single stone)
  const isKo = totalCaptures === 1 && capturedPositions.length === 1 && 
               getNeighbors(x, y, size).some(n => 
                 n.x === capturedPositions[0].x && n.y === capturedPositions[0].y);

  if (isKo) {
    return { legal: false };
  }

  return { 
    legal: true, 
    board: testBoard, 
    captures: totalCaptures,
    capturedPositions 
  };
}

// ---- AI Logic ----
function calculateMoveScore(board: Stone[][], x: number, y: number, color: Stone, difficulty: Difficulty): number {
  const size = board.length;
  let score = 0;

  const result = tryPlay(board, x, y, color);
  if (!result.legal) return -Infinity;

  // Base scores
  const captures = result.captures || 0;
  const centerX = Math.floor(size / 2);
  const centerY = Math.floor(size / 2);
  const distanceFromCenter = Math.abs(centerX - x) + Math.abs(centerY - y);

  score += captures * 20;
  score -= distanceFromCenter * 3;

  // Difficulty-based scoring
  if (difficulty === 'easy') {
    score += Math.random() * 30 - 15;
  } else {
    // Strategic considerations
    const neighbors = getNeighbors(x, y, size);
    const friendlyNeighbors = neighbors.filter(n => board[n.y][n.x] === color).length;
    const opponentNeighbors = neighbors.filter(n => board[n.y][n.x] === (color === 1 ? 2 : 1)).length;
    
    score += friendlyNeighbors * 8;
    score += opponentNeighbors * 6;

    if (difficulty === 'hard') {
      // Advanced positional evaluation
      const cornerBonus = (x === 0 || x === size-1) && (y === 0 || y === size-1) ? 5 : 0;
      const sideBonus = (x === 0 || x === size-1 || y === 0 || y === size-1) ? 3 : 0;
      score += cornerBonus + sideBonus;
    }
  }

  return score;
}

function pickAiMove(board: Stone[][], color: Stone, difficulty: Difficulty): Position | null {
  const size = board.length;
  const candidates: { position: Position; score: number }[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const score = calculateMoveScore(board, x, y, color, difficulty);
      if (score > -Infinity) {
        candidates.push({ position: { x, y }, score });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);

  // Select move based on difficulty
  let selectedIndex = 0;
  if (difficulty === 'easy' && candidates.length > 3) {
    selectedIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
  } else if (difficulty === 'medium' && candidates.length > 2) {
    selectedIndex = Math.floor(Math.random() * Math.min(3, candidates.length));
  }

  return candidates[selectedIndex].position;
}

// ---- UI Components ----
const Stone = React.memo(({ 
  color, 
  size = 'medium', 
  isLastMove = false,
  isAnimating = false 
}: { 
  color: Stone;
  size?: 'small' | 'medium' | 'large';
  isLastMove?: boolean;
  isAnimating?: boolean;
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-7 h-7',
    large: 'w-10 h-10'
  };

  return (
    <div className={`
      absolute rounded-full border-2 transition-all duration-300
      ${sizeClasses[size]}
      ${color === 1 ? 'bg-gray-900 border-gray-700 shadow-lg' : 'bg-white border-gray-300 shadow-lg'}
      ${isLastMove ? 'ring-2 ring-blue-400 ring-opacity-70' : ''}
      ${isAnimating ? 'animate-pulse scale-110' : ''}
    `} />
  );
});

const BoardCell = React.memo(({
  position,
  stone,
  boardSize,
  cellSize,
  isHovered,
  isValidMove,
  isStarPoint,
  onHover,
  onClick,
  currentPlayer
}: {
  position: Position;
  stone: Stone;
  boardSize: number;
  cellSize: number;
  isHovered: boolean;
  isValidMove: boolean;
  isStarPoint: boolean;
  onHover: (position: Position | null) => void;
  onClick: (position: Position) => void;
  currentPlayer: Stone;
}) => {
  const { x, y } = position;

  return (
    <button
      className={`absolute cursor-pointer transition-all duration-200 ${
        isHovered && stone === 0 && isValidMove ? 'bg-blue-200 bg-opacity-50 rounded-full' : ''
      }`}
      style={{
        left: x * cellSize,
        top: y * cellSize,
        width: 24,
        height: 24,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseEnter={() => onHover(position)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(position)}
      disabled={!isValidMove || stone !== 0}
    >
      {/* Grid lines */}
      <div className="absolute inset-0 pointer-events-none">
        {y > 0 && <div className="absolute top-0 left-1/2 w-px h-full bg-amber-700 -translate-x-1/2" />}
        {x > 0 && <div className="absolute left-0 top-1/2 h-px w-full bg-amber-700 -translate-y-1/2" />}
      </div>

      {/* Star point */}
      {isStarPoint && stone === 0 && (
        <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-700" 
             style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
      )}

      {/* Hover preview */}
      {isHovered && stone === 0 && isValidMove && (
        <div className={`absolute w-4 h-4 rounded-full opacity-50 ${
          currentPlayer === 1 ? 'bg-gray-900' : 'bg-white border border-gray-400'
        }`} style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
      )}

      {/* Stone */}
      {stone !== 0 && <Stone color={stone} />}
    </button>
  );
});

// ---- Main Game Component ----
const GoGame = () => {
  const [gameMode, setGameMode] = useState<GameMode>('local');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [board, setBoard] = useState<Stone[][]>(() => makeEmptyBoard(settings.boardSize));
  const [currentPlayer, setCurrentPlayer] = useState<Stone>(1);
  const [captures, setCaptures] = useState<Captures>({ black: 0, white: 0 });
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [passCount, setPassCount] = useState(0);
  const [hoverPosition, setHoverPosition] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [gameScore, setGameScore] = useState<GameScore | null>(null);
  const [animatingCaptures, setAnimatingCaptures] = useState<Position[]>([]);
  const [timer, setTimer] = useState<TimerState>({ black: settings.timePerMove, white: settings.timePerMove, isRunning: false });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize game
  const initializeGame = useCallback(() => {
    const newBoard = makeEmptyBoard(settings.boardSize);
    setBoard(newBoard);
    setCurrentPlayer(1);
    setCaptures({ black: 0, white: 0 });
    setMoveHistory([]);
    setGameStatus('playing');
    setPassCount(0);
    setLastMove(null);
    setShowScore(false);
    setGameScore(null);
    setAnimatingCaptures([]);
    setTimer({ 
      black: settings.timePerMove, 
      white: settings.timePerMove, 
      isRunning: false 
    });
  }, [settings.boardSize, settings.timePerMove]);

  // Timer management
  useEffect(() => {
    if (timer.isRunning && gameStatus === 'playing') {
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          const currentTime = currentPlayer === 1 ? prev.black : prev.white;
          if (currentTime <= 1) {
            // Time out
            handleTimeOut(currentPlayer);
            return { ...prev, isRunning: false };
          }
          
          return {
            ...prev,
            [currentPlayer === 1 ? 'black' : 'white']: currentTime - 1
          };
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timer.isRunning, gameStatus, currentPlayer]);

  const startTimer = useCallback(() => {
    setTimer(prev => ({ ...prev, isRunning: true }));
  }, []);

  const pauseTimer = useCallback(() => {
    setTimer(prev => ({ ...prev, isRunning: false }));
  }, []);

  const resetTimer = useCallback((player: Stone) => {
    setTimer(prev => ({
      ...prev,
      [player === 1 ? 'black' : 'white']: settings.timePerMove
    }));
  }, [settings.timePerMove]);

  const handleTimeOut = useCallback((player: Stone) => {
    pauseTimer();
    setGameStatus('finished');
    
    const winner = player === 1 ? 'white' : 'black';
    setGameScore({
      blackScore: 0,
      whiteScore: 0,
      blackTerritory: 0,
      whiteTerritory: 0,
      komi: settings.komi,
      winner
    });
    setShowScore(true);
  }, [pauseTimer, settings.komi]);

  // Move validation
  const isValidMove = useCallback((position: Position): boolean => {
    const { x, y } = position;
    
    if (board[y][x] !== 0) return false;
    if (gameStatus !== 'playing') return false;
    
    const result = tryPlay(board, x, y, currentPlayer);
    return result.legal;
  }, [board, gameStatus, currentPlayer]);

  // Territory calculation
  const calculateTerritory = useCallback((): { black: number; white: number } => {
    const size = board.length;
    const visited = new Set<string>();
    let blackTerritory = 0;
    let whiteTerritory = 0;

    const floodFill = (startX: number, startY: number): { points: Position[]; owner: Stone } => {
      if (visited.has(`${startX},${startY}`) || board[startY][startX] !== 0) {
        return { points: [], owner: 0 };
      }

      const queue: Position[] = [{ x: startX, y: startY }];
      const territory: Position[] = [];
      const borderStones = new Set<Stone>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(`${current.x},${current.y}`)) continue;
        
        visited.add(`${current.x},${current.y}`);
        territory.push(current);

        for (const neighbor of getNeighbors(current.x, current.y, size)) {
          const neighborStone = board[neighbor.y][neighbor.x];
          if (neighborStone === 0 && !visited.has(`${neighbor.x},${neighbor.y}`)) {
            queue.push(neighbor);
          } else if (neighborStone !== 0) {
            borderStones.add(neighborStone);
          }
        }
      }

      let owner: Stone = 0;
      if (borderStones.size === 1) {
        owner = Array.from(borderStones)[0];
      }

      return { points: territory, owner };
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!visited.has(`${x},${y}`) && board[y][x] === 0) {
          const territory = floodFill(x, y);
          if (territory.owner === 1) {
            blackTerritory += territory.points.length;
          } else if (territory.owner === 2) {
            whiteTerritory += territory.points.length;
          }
        }
      }
    }

    return { black: blackTerritory, white: whiteTerritory };
  }, [board]);

  // Score calculation
  const calculateScore = useCallback((): GameScore => {
    const territory = calculateTerritory();
    const stoneCount = board.flat().reduce((acc, stone) => {
      if (stone === 1) acc.black++;
      if (stone === 2) acc.white++;
      return acc;
    }, { black: 0, white: 0 });

    const blackScore = territory.black + stoneCount.black + captures.black;
    const whiteScore = territory.white + stoneCount.white + captures.white + settings.komi;

    let winner: 'black' | 'white' | 'draw';
    if (Math.abs(blackScore - whiteScore) < 0.1) {
      winner = 'draw';
    } else {
      winner = blackScore > whiteScore ? 'black' : 'white';
    }

    return {
      blackScore,
      whiteScore,
      blackTerritory: territory.black,
      whiteTerritory: territory.white,
      komi: settings.komi,
      winner
    };
  }, [board, captures, settings.komi, calculateTerritory]);

  // Handle stone placement
  const handlePlaceStone = useCallback((position: Position) => {
    if (!isValidMove(position)) return;

    const result = tryPlay(board, position.x, position.y, currentPlayer);
    if (!result.legal || !result.board) return;

    // Update board and captures
    setBoard(result.board);
    setLastMove(position);
    
    if (result.captures && result.captures > 0) {
      setCaptures(prev => ({
        ...prev,
        [currentPlayer === 1 ? 'black' : 'white']: prev[currentPlayer === 1 ? 'black' : 'white'] + result.captures!
      }));
      
      // Animate captures
      if (result.capturedPositions) {
        setAnimatingCaptures(result.capturedPositions);
        setTimeout(() => setAnimatingCaptures([]), 500);
      }
    }

    // Add to history
    const newMove: GameMove = {
      player: currentPlayer,
      position,
      timestamp: Date.now(),
      captures: result.captures || 0,
      boardState: cloneBoard(result.board)
    };
    setMoveHistory(prev => [...prev, newMove]);

    // Switch player
    const nextPlayer: Stone = currentPlayer === 1 ? 2 : 1;
    setCurrentPlayer(nextPlayer);
    setPassCount(0);

    // Timer management
    resetTimer(currentPlayer);
    if (gameMode === 'ai' && nextPlayer === 2) {
      pauseTimer();
      // AI will move after a short delay
      setTimeout(() => handleAIMove(), 500);
    } else {
      startTimer();
    }
  }, [board, currentPlayer, gameMode, isValidMove, pauseTimer, resetTimer, startTimer]);

  // AI move
  const handleAIMove = useCallback(() => {
    if (gameStatus !== 'playing' || currentPlayer !== 2) return;

    const aiMove = pickAiMove(board, 2, settings.difficulty);
    if (aiMove) {
      handlePlaceStone(aiMove);
    } else {
      handlePass();
    }
  }, [board, currentPlayer, gameStatus, settings.difficulty, handlePlaceStone]);

  // Handle pass
  const handlePass = useCallback(() => {
    const newPassCount = passCount + 1;
    setPassCount(newPassCount);

    const passMove: GameMove = {
      player: currentPlayer,
      position: { x: -1, y: -1 },
      timestamp: Date.now(),
      captures: 0,
      isPass: true,
      boardState: cloneBoard(board)
    };
    setMoveHistory(prev => [...prev, passMove]);

    if (newPassCount >= 2) {
      // Game ends
      setGameStatus('finished');
      const finalScore = calculateScore();
      setGameScore(finalScore);
      setShowScore(true);
      pauseTimer();
    }

    const nextPlayer: Stone = currentPlayer === 1 ? 2 : 1;
    setCurrentPlayer(nextPlayer);
    resetTimer(currentPlayer);

    if (gameMode === 'ai' && nextPlayer === 2) {
      pauseTimer();
      setTimeout(() => handleAIMove(), 500);
    } else {
      startTimer();
    }
  }, [passCount, currentPlayer, board, gameMode, calculateScore, handleAIMove, pauseTimer, resetTimer, startTimer]);

  // Undo move
  const handleUndo = useCallback(() => {
    if (moveHistory.length === 0) return;

    const lastMove = moveHistory[moveHistory.length - 1];
    const newHistory = moveHistory.slice(0, -1);
    
    if (lastMove.isPass) {
      setPassCount(prev => Math.max(0, prev - 1));
    } else {
      // Restore board state from previous move
      const previousMove = newHistory[newHistory.length - 1];
      if (previousMove) {
        setBoard(previousMove.boardState);
      } else {
        setBoard(makeEmptyBoard(settings.boardSize));
      }
      
      // Update captures
      if (lastMove.captures > 0) {
        setCaptures(prev => ({
          ...prev,
          [lastMove.player === 1 ? 'black' : 'white']: 
            Math.max(0, prev[lastMove.player === 1 ? 'black' : 'white'] - lastMove.captures)
        }));
      }
    }

    setMoveHistory(newHistory);
    setCurrentPlayer(lastMove.player);
    
    if (gameStatus === 'finished') {
      setGameStatus('playing');
      setShowScore(false);
    }
  }, [moveHistory, gameStatus, settings.boardSize]);

  // Initialize game on settings change
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Render board
  const renderBoard = useMemo(() => {
    const size = settings.boardSize;
    const displaySize = size === 9 ? 400 : size === 13 ? 450 : 500;
    const cellSize = displaySize / (size - 1);
    const starPoints = STAR_POINTS[size as keyof typeof STAR_POINTS] || [];

    return (
      <div 
        className="relative bg-amber-100 border-4 border-amber-800 rounded-lg shadow-2xl"
        style={{ width: displaySize, height: displaySize }}
      >
        {/* Grid lines */}
        {Array.from({ length: size }).map((_, index) => (
          <React.Fragment key={index}>
            <div 
              className="absolute bg-amber-700"
              style={{
                left: 0,
                top: index * cellSize,
                width: '100%',
                height: 1
              }}
            />
            <div 
              className="absolute bg-amber-700"
              style={{
                top: 0,
                left: index * cellSize,
                height: '100%',
                width: 1
              }}
            />
          </React.Fragment>
        ))}

        {/* Star points */}
        {starPoints.map(([x, y], index) => (
          <div
            key={index}
            className="absolute w-2 h-2 bg-amber-700 rounded-full"
            style={{
              left: x * cellSize,
              top: y * cellSize,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}

        {/* Board cells */}
        {board.map((row, y) =>
          row.map((stone, x) => (
            <BoardCell
              key={`${x}-${y}`}
              position={{ x, y }}
              stone={stone}
              boardSize={size}
              cellSize={cellSize}
              isHovered={hoverPosition?.x === x && hoverPosition?.y === y}
              isValidMove={isValidMove({ x, y })}
              isStarPoint={starPoints.some(([sx, sy]) => sx === x && sy === y)}
              onHover={setHoverPosition}
              onClick={handlePlaceStone}
              currentPlayer={currentPlayer}
            />
          ))
        )}

        {/* Last move indicator */}
        {lastMove && (
          <div
            className="absolute w-3 h-3 bg-blue-500 rounded-full animate-pulse"
            style={{
              left: lastMove.x * cellSize,
              top: lastMove.y * cellSize,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}
      </div>
    );
  }, [board, settings.boardSize, hoverPosition, lastMove, currentPlayer, isValidMove, handlePlaceStone]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 py-8 px-4">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Game header */}
        <div className="bg-gray-800 text-white p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Cờ Vây Pro</h1>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full ${
                currentPlayer === 1 ? 'bg-black' : 'bg-white text-black'
              }`}>
                Lượt: {currentPlayer === 1 ? 'Đen' : 'Trắng'}
              </span>
              <span className="bg-blue-500 px-3 py-1 rounded-full">
                Thời gian: {timer.black}s / {timer.white}s
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Main game area */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Board area */}
            <div className="flex-1">
              <div className="flex justify-center mb-6">
                {renderBoard}
              </div>

              {/* Game controls */}
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={handlePass}
                  disabled={gameStatus !== 'playing'}
                  className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300"
                >
                  Pass (P)
                </button>
                <button
                  onClick={handleUndo}
                  disabled={moveHistory.length === 0}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
                >
                  Undo (Ctrl+Z)
                </button>
                <button
                  onClick={initializeGame}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Chơi lại
                </button>
                <button
                  onClick={() => {
                    const score = calculateScore();
                    setGameScore(score);
                    setShowScore(true);
                  }}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Tính điểm
                </button>
              </div>
            </div>

            {/* Side panel */}
            <div className="lg:w-80 space-y-6">
              {/* Game info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-3">Thông tin ván cờ</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Quân bắt được:</span>
                    <span>Đen: {captures.black} | Trắng: {captures.white}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Komi:</span>
                    <span>{settings.komi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số nước:</span>
                    <span>{moveHistory.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pass liên tiếp:</span>
                    <span>{passCount}/2</span>
                  </div>
                </div>
              </div>

              {/* Move history */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-3">Lịch sử nước đi</h3>
                <div className="max-h-40 overflow-y-auto">
                  {moveHistory.slice(-10).map((move, index) => (
                    <div key={index} className="flex justify-between text-sm py-1">
                      <span>{moveHistory.length - 9 + index}.</span>
                      <span className={move.player === 1 ? 'text-black' : 'text-gray-600'}>
                        {move.player === 1 ? 'Đen' : 'Trắng'}
                      </span>
                      <span>
                        {move.isPass ? 'Pass' : `${String.fromCharCode(65 + move.position.x)}${settings.boardSize - move.position.y}`}
                      </span>
                      {move.captures > 0 && <span className="text-red-600">+{move.captures}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Score modal */}
      {showScore && gameScore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Kết quả ván cờ</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Điểm Đen:</span>
                <span className="font-bold">{gameScore.blackScore.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span>Điểm Trắng:</span>
                <span className="font-bold">{gameScore.whiteScore.toFixed(1)}</span>
              </div>
              <div className="text-center font-bold text-lg mt-4">
                {gameScore.winner === 'draw' ? 'HÒA' : `${gameScore.winner === 'black' ? 'ĐEN' : 'TRẮNG'} THẮNG`}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScore(false)}
                className="flex-1 py-2 bg-gray-500 text-white rounded-lg"
              >
                Đóng
              </button>
              <button
                onClick={initializeGame}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg"
              >
                Ván mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoGame;
