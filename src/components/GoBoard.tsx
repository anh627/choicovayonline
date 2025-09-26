import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';

// Types
import { GameMove, GameScore, Player, BoardSize } from '../types/goTypes';

// Constants
import { EMPTY, BLACK, WHITE, STAR_POINTS } from '../game/constants';

// Sound
import { playSound } from '../utils/sound';

// Game Rules
import {
  hasLiberties,
  isSuicideMove,
  checkCaptures,
  isKoViolation as checkKoRule
} from '../game/rules/goRules';

// AI
import { makeRandomMove, makeHeuristicMove } from '../game/ai';

// Types for internal use
type GameMode = 'human-vs-human' | 'human-vs-ai' | 'ai-vs-ai';
type AIDifficulty = 'easy' | 'medium';

// Memoized Stone Component
const Stone = memo(({ color, isAnimating }: { color: Player; isAnimating?: boolean }) => {
  return (
    <div 
      className={`absolute w-6 h-6 rounded-full border-2 transition-all duration-300 ${
        color === BLACK 
          ? 'bg-gray-900 border-gray-700 shadow-lg' 
          : 'bg-white border-gray-300 shadow-lg'
      } ${isAnimating ? 'animate-pulse scale-110' : ''}`}
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        boxShadow: color === BLACK 
          ? '0 2px 4px rgba(0,0,0,0.3)' 
          : '0 2px 4px rgba(0,0,0,0.2)',
      }}
    />
  );
});

// Memoized Board Cell
const BoardCell = memo(({ 
  row, 
  col, 
  stone, 
  isHovered, 
  currentPlayer, 
  isValidMove,
  onClick,
  cellSize 
}: {
  row: number;
  col: number;
  stone: Player;
  isHovered: boolean;
  currentPlayer: Player;
  isValidMove: boolean;
  onClick: (row: number, col: number) => void;
  cellSize: number;
}) => {
  return (
    <div 
      className={`absolute cursor-pointer transition-all duration-200 ${
        isHovered && stone === EMPTY && isValidMove 
          ? 'bg-blue-200 bg-opacity-50 rounded-full' 
          : ''
      }`}
      style={{
        left: col * cellSize,
        top: row * cellSize,
        width: 24,
        height: 24,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={() => onClick(row, col)}
    >
      {stone !== EMPTY && <Stone color={stone} />}
      {isHovered && stone === EMPTY && isValidMove && (
        <div 
          className={`absolute w-4 h-4 rounded-full opacity-50 ${
            currentPlayer === BLACK ? 'bg-gray-900' : 'bg-white border border-gray-400'
          }`}
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  );
});

const GoBoard = () => {
  // State for game configuration
  const [boardSize, setBoardSize] = useState<BoardSize>(19);
  const [gameMode, setGameMode] = useState<GameMode>('human-vs-human');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('easy');

  // Initialize empty board
  const initializeBoard = useCallback((size: BoardSize) => {
    return Array(size).fill(null).map(() => Array(size).fill(EMPTY));
  }, []);

  // Game state
  const [board, setBoard] = useState<Player[][]>(initializeBoard(boardSize));
  const [currentPlayer, setCurrentPlayer] = useState<Player>(BLACK);
  const [blackCaptures, setBlackCaptures] = useState<number>(0);
  const [whiteCaptures, setWhiteCaptures] = useState<number>(0);
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([]);
  const [passCount, setPassCount] = useState<number>(0);
  const [gameStatus, setGameStatus] = useState<string>('Playing');
  const [koPosition, setKoPosition] = useState<{row: number, col: number} | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{row: number, col: number} | null>(null);
  const [invalidMoveMessage, setInvalidMoveMessage] = useState<string>('');
  const [showScore, setShowScore] = useState<boolean>(false);
  const [gameScore, setGameScore] = useState<GameScore>({ blackScore: 0, whiteScore: 0, blackTerritory: 0, whiteTerritory: 0 });
  const [animatingCaptures, setAnimatingCaptures] = useState<[number, number][]>([]);

  // Validate move
  const isValidMove = useCallback((row: number, col: number) => {
    if (board[row]?.[col] !== EMPTY) return false;
    if (gameStatus !== 'Playing') return false;
    if (checkKoRule(koPosition, row, col)) return false;
    if (isSuicideMove(board, row, col, currentPlayer, boardSize)) return false;
    return true;
  }, [board, gameStatus, koPosition, currentPlayer, boardSize]);

  // Handle stone placement
  const handleStonePlacement = useCallback((row: number, col: number) => {
    setInvalidMoveMessage('');
    
    if (board[row]?.[col] !== EMPTY) {
      setInvalidMoveMessage('Position already occupied');
      playSound('invalid');
      return;
    }
    
    if (gameStatus !== 'Playing') {
      setInvalidMoveMessage('Game is finished');
      playSound('invalid');
      return;
    }
    
    if (checkKoRule(koPosition, row, col)) {
      setInvalidMoveMessage('Ko rule violation');
      playSound('invalid');
      return;
    }
    
    if (isSuicideMove(board, row, col, currentPlayer, boardSize)) {
      setInvalidMoveMessage('Suicide move not allowed');
      playSound('invalid');
      return;
    }
    
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    
    const { newBoard: capturedBoard, captures, capturedPositions, koPosition: newKoPosition } = checkCaptures(newBoard, row, col, currentPlayer, boardSize);
    
    if (capturedPositions.length > 0) {
      setAnimatingCaptures(capturedPositions);
      setTimeout(() => setAnimatingCaptures([]), 500);
      playSound('capture');
    } else {
      playSound('place');
    }
    
    if (currentPlayer === BLACK && captures > 0) {
      setWhiteCaptures(prev => prev + captures);
    } else if (currentPlayer === WHITE && captures > 0) {
      setBlackCaptures(prev => prev + captures);
    }
    
    setBoard(capturedBoard);
    setKoPosition(newKoPosition);
    
    const move: GameMove = {
      player: currentPlayer,
      row,
      col,
      timestamp: Date.now(),
      captures,
      isPass: false
    };
    setMoveHistory(prev => [...prev, move]);
    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
    setPassCount(0);
  }, [board, gameStatus, koPosition, currentPlayer, boardSize]);

  // Handle pass
  const handlePass = useCallback(() => {
    const newPassCount = passCount + 1;
    setPassCount(newPassCount);
    
    const move: GameMove = {
      player: currentPlayer,
      row: -1,
      col: -1,
      timestamp: Date.now(),
      captures: 0,
      isPass: true
    };
    setMoveHistory(prev => [...prev, move]);
    
    if (newPassCount >= 2) {
      setGameStatus('Finished');
      const finalScore = calculateScore();
      setGameScore(finalScore);
      setShowScore(true);
    }
    
    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
    playSound('pass');
  }, [passCount, currentPlayer, boardSize]);

  // Calculate territory and final score
  const calculateScore = useCallback(() => {
    const visited: boolean[][] = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false));
    let blackTerritory = 0;
    let whiteTerritory = 0;
    
    const floodFill = (startRow: number, startCol: number): { points: [number, number][]; owner: Player } => {
      if (visited[startRow][startCol] || board[startRow][startCol] !== EMPTY) {
        return { points: [], owner: EMPTY };
      }
      
      const queue: [number, number][] = [[startRow, startCol]];
      const territory: [number, number][] = [];
      const borderColors = new Set<Player>();
      
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
      
      let owner: Player = EMPTY;
      if (borderColors.size === 1) {
        owner = Array.from(borderColors)[0] as Player;
      }
      
      return { points: territory, owner };
    };
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (!visited[row][col] && board[row][col] === EMPTY) {
          const territory = floodFill(row, col);
          if (territory.owner === BLACK) {
            blackTerritory += territory.points.length;
          } else if (territory.owner === WHITE) {
            whiteTerritory += territory.points.length;
          }
        }
      }
    }
    
    return {
      blackScore: blackTerritory + blackCaptures,
      whiteScore: whiteTerritory + whiteCaptures,
      blackTerritory,
      whiteTerritory
    };
  }, [board, blackCaptures, whiteCaptures, boardSize]);

  // AI Move
  const makeAIMove = useCallback(() => {
    let aiMove: { row: number; col: number } | null = null;

    if (aiDifficulty === 'easy') {
      aiMove = makeRandomMove(board, currentPlayer, boardSize, isValidMove);
    } else if (aiDifficulty === 'medium') {
      aiMove = makeHeuristicMove(board, currentPlayer, boardSize, isValidMove);
    }

    if (aiMove) {
      handleStonePlacement(aiMove.row, aiMove.col);
    } else {
      handlePass();
    }
  }, [board, currentPlayer, boardSize, aiDifficulty, isValidMove, handleStonePlacement, handlePass]);

  // Auto AI play
  useEffect(() => {
    if (gameStatus !== 'Playing') return;

    const isAiTurn = 
      (gameMode === 'human-vs-ai' && currentPlayer === WHITE) ||
      (gameMode === 'ai-vs-ai');

    if (isAiTurn) {
      const timer = setTimeout(() => makeAIMove(), 600);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, gameStatus, gameMode, makeAIMove]);

  // Reset game with new size
  const resetGameWithSize = useCallback((newSize: BoardSize) => {
    setBoardSize(newSize);
    setBoard(initializeBoard(newSize));
    setCurrentPlayer(BLACK);
    setBlackCaptures(0);
    setWhiteCaptures(0);
    setMoveHistory([]);
    setPassCount(0);
    setGameStatus('Playing');
    setKoPosition(null);
    setHoverPosition(null);
    setInvalidMoveMessage('');
    setShowScore(false);
    setGameScore({ blackScore: 0, whiteScore: 0, blackTerritory: 0, whiteTerritory: 0 });
    setAnimatingCaptures([]);
  }, [initializeBoard]);

  // Reset game
  const resetGame = useCallback(() => {
    resetGameWithSize(boardSize);
  }, [boardSize, resetGameWithSize]);

  // Undo last move
  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) return;
    
    const newHistory = moveHistory.slice(0, -1);
    setMoveHistory(newHistory);
    
    const newBoard = initializeBoard(boardSize);
    let newBlackCaptures = 0;
    let newWhiteCaptures = 0;
    let newKoPosition = null;
    
    for (const move of newHistory) {
      if (!move.isPass) {
        newBoard[move.row][move.col] = move.player;
        const { newBoard: capturedBoard, captures, koPosition } = checkCaptures(newBoard, move.row, move.col, move.player, boardSize);
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            newBoard[r][c] = capturedBoard[r][c];
          }
        }
        
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
    
    const lastMove = moveHistory[moveHistory.length - 1];
    setCurrentPlayer(lastMove.player);
    
    if (gameStatus === 'Finished') {
      setGameStatus('Playing');
      setShowScore(false);
    }
    
    const recentPasses = newHistory.slice(-2).filter(move => move.isPass).length;
    setPassCount(recentPasses);
  }, [moveHistory, boardSize, initializeBoard, gameStatus]);

  // Export game to SGF
  const exportSGF = useCallback(() => {
    let sgf = `(;FF[4]GM[1]SZ[${boardSize}]`;
    sgf += `DT[${new Date().toISOString().split('T')[0]}]`;
    sgf += `KM[6.5]`;
    
    moveHistory.forEach((move) => {
      if (move.isPass) {
        const color = move.player === BLACK ? 'B' : 'W';
        sgf += `;${color}[]`;
      } else {
        const color = move.player === BLACK ? 'B' : 'W';
        const position = String.fromCharCode(97 + move.col) + String.fromCharCode(97 + move.row);
        sgf += `;${color}[${position}]`;
      }
    });
    
    sgf += ")";
    
    const blob = new Blob([sgf], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `go-game-${Date.now()}.sgf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [moveHistory, boardSize]);

  // Load SGF
  const loadSGF = useCallback((sgfContent: string) => {
    const moves = sgfContent.match(/;[BW]```math
[a-s]*```/g) || [];
    resetGame();
    
    let moveIndex = 0;
    const playNextMove = () => {
      if (moveIndex >= moves.length) return;
      
      const moveStr = moves[moveIndex];
      const isPass = moveStr.includes('[]');
      const color = moveStr.includes(';B') ? BLACK : WHITE;
      
      if (isPass) {
        setTimeout(() => {
          handlePass();
          moveIndex++;
          playNextMove();
        }, 300);
      } else {
        const posMatch = moveStr.match(/```math
([a-s]{2})```/);
        if (posMatch) {
          const pos = posMatch[1];
          const col = pos.charCodeAt(0) - 97;
          const row = pos.charCodeAt(1) - 97;
          
          if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
            setTimeout(() => {
              handleStonePlacement(row, col);
              moveIndex++;
              playNextMove();
            }, 300);
          } else {
            moveIndex++;
            playNextMove();
          }
        } else {
          moveIndex++;
          playNextMove();
        }
      }
    };
    
    playNextMove();
  }, [resetGame, handleStonePlacement, handlePass, boardSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['input', 'textarea'].includes(e.target.tagName.toLowerCase())) {
        return;
      }
      
      switch (e.key) {
        case 'p':
        case 'P':
          handlePass();
          break;
        case 'u':
        case 'U':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            undoMove();
          }
          break;
        case 'r':
        case 'R':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetGame();
          }
          break;
        case 's':
        case 'S':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            exportSGF();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePass, undoMove, resetGame, exportSGF]);

  // Auto-clear invalid move message
  useEffect(() => {
    if (invalidMoveMessage) {
      const timer = setTimeout(() => setInvalidMoveMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [invalidMoveMessage]);

  // Memoized board rendering
  const renderBoard = useMemo(() => {
    const boardDisplaySize = 500;
    const cellSize = boardDisplaySize / (boardSize - 1);
    
    return (
      <div 
        className="relative bg-amber-100 border-4 border-amber-800 rounded-sm shadow-2xl"
        style={{ width: boardDisplaySize, height: boardDisplaySize }}
        onMouseLeave={() => setHoverPosition(null)}
      >
        {/* Grid lines */}
        {Array.from({ length: boardSize }).map((_, i) => (
          <React.Fragment key={i}>
            <div 
              className="absolute bg-gray-800" 
              style={{
                left: 0,
                top: i * cellSize,
                width: '100%',
                height: 1,
              }}
            />
            <div 
              className="absolute bg-gray-800" 
              style={{
                top: 0,
                left: i * cellSize,
                height: '100%',
                width: 1,
              }}
            />
          </React.Fragment>
        ))}
        
        {/* Star points */}
        {STAR_POINTS[boardSize].map(([row, col]) => (
          <div 
            key={`star-${row}-${col}`}
            className="absolute w-2 h-2 bg-gray-800 rounded-full"
            style={{
              left: col * cellSize,
              top: row * cellSize,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
        
        {/* Board cells with stones */}
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
            />
          ))
        )}
        
        {/* Hover detection overlay */}
        <div 
          className="absolute inset-0"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
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
    );
  }, [board, hoverPosition, currentPlayer, isValidMove, handleStonePlacement, boardSize]);

  // Score Modal
  const ScoreModal = () => {
    if (!showScore) return null;
    
    const winner = gameScore.blackScore > gameScore.whiteScore ? 'Black' : 
                   gameScore.whiteScore > gameScore.blackScore ? 'White' : 'Tie';
    const margin = Math.abs(gameScore.blackScore - gameScore.whiteScore);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold text-center mb-6">Game Finished!</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Black Score:</span>
              <span>{gameScore.blackScore} ({gameScore.blackTerritory} territory + {blackCaptures} captures)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold">White Score:</span>
              <span>{gameScore.whiteScore} ({gameScore.whiteTerritory} territory + {whiteCaptures} captures)</span>
            </div>
            <hr />
            <div className="text-center">
              <div className="text-xl font-bold">
                {winner === 'Tie' ? 'Game is a Tie!' : `${winner} wins by ${margin} points!`}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button 
              onClick={() => setShowScore(false)}
              className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Continue Viewing
            </button>
            <button 
              onClick={resetGame}
              className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              New Game
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 py-8 px-4">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">Professional Go Board</h1>
          <p className="text-center text-gray-600 mb-6">Full-featured Go game with AI, multiple board sizes, and advanced rules</p>
          
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
                  <div className="text-sm text-gray-600">
                    Move: {moveHistory.length}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center">
                {renderBoard}
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="xl:w-80">
              {/* Game Configuration */}
              <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Setup</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Board Size</label>
                    <select 
                      value={boardSize}
                      onChange={(e) => resetGameWithSize(Number(e.target.value) as BoardSize)}
                      className="w-full p-2 border rounded"
                      disabled={moveHistory.length > 0}
                    >
                      <option value={9}>9×9 (Beginner)</option>
                      <option value={13}>13×13 (Intermediate)</option>
                      <option value={19}>19×19 (Professional)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Game Mode</label>
                    <select 
                      value={gameMode}
                      onChange={(e) => setGameMode(e.target.value as GameMode)}
                      className="w-full p-2 border rounded"
                      disabled={moveHistory.length > 0}
                    >
                      <option value="human-vs-human">Human vs Human</option>
                      <option value="human-vs-ai">Human vs AI</option>
                      <option value="ai-vs-ai">AI vs AI (Demo)</option>
                    </select>
                  </div>
                  
                  {gameMode !== 'human-vs-human' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">AI Difficulty</label>
                      <select 
                        value={aiDifficulty}
                        onChange={(e) => setAiDifficulty(e.target.value as AIDifficulty)}
                        className="w-full p-2 border rounded"
                      >
                        <option value="easy">Easy (Random)</option>
                        <option value="medium">Medium (Heuristic)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Game Status */}
              <div className="bg-gray-50 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Status</h2>
                
                <div className="mb-4">
                  <div className="flex items-center mb-2">
                    <div className={`w-4 h-4 rounded-full mr-2 ${currentPlayer === BLACK ? 'bg-gray-900' : 'bg-white border border-gray-300'}`}></div>
                    <span className="font-medium">
                      Current Player: <span className="font-bold">{currentPlayer === BLACK ? 'Black' : 'White'}</span>
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {gameStatus === 'Playing' 
                      ? 'Click on an intersection to place a stone' 
                      : 'Game finished! Check the score.'}
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
                    disabled={gameStatus !== 'Playing'}
                    className={`py-2 px-4 rounded-lg transition-colors ${
                      gameStatus !== 'Playing' 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    Pass Turn (P)
                  </button>
                  
                  <button 
                    onClick={undoMove}
                    disabled={moveHistory.length === 0}
                    className={`py-2 px-4 rounded-lg transition-colors ${
                      moveHistory.length === 0 
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
                    }}
                    className="py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Calculate Score
                  </button>
                  
                  {gameMode === 'human-vs-human' && (
                    <button 
                      onClick={makeAIMove}
                      disabled={gameStatus !== 'Playing'}
                      className={`py-2 px-4 rounded-lg transition-colors ${
                        gameStatus !== 'Playing'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      AI Suggest Move
                    </button>
                  )}
                  
                  <button 
                    onClick={resetGame}
                    className="py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Reset Game (Ctrl+R)
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
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
                        : '0m'
                      }
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
                          <span className="font-medium">
                            {moveHistory.length - 10 + index + 1}.
                          </span>
                          <span className={move.player === BLACK ? 'text-gray-900' : 'text-gray-600'}>
                            {move.player === BLACK ? 'Black' : 'White'}
                          </span>
                          <span>
                            {move.isPass 
                              ? 'Pass' 
                              : `${String.fromCharCode(65 + move.col)}${boardSize - move.row}`
                            }
                          </span>
                          {move.captures > 0 && (
                            <span className="text-red-600 text-xs">
                              +{move.captures}
                            </span>
                          )}
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
                      <li>• Black plays first</li>
                      <li>• Capture by surrounding (no liberties)</li>
                      <li>• No suicide moves allowed</li>
                      <li>• Ko rule prevents immediate recapture</li>
                      <li>• Game ends with two consecutive passes</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">Keyboard Shortcuts:</h3>
                    <ul className="space-y-1 ml-2">
                      <li>• <kbd className="bg-gray-200 px-1 rounded">P</kbd> - Pass turn</li>
                      <li>• <kbd className="bg-gray-200 px-1 rounded">Ctrl+U</kbd> - Undo move</li>
                      <li>• <kbd className="bg-gray-200 px-1 rounded">Ctrl+R</kbd> - Reset game</li>
                      <li>• <kbd className="bg-gray-200 px-1 rounded">Ctrl+S</kbd> - Export SGF</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">Features:</h3>
                    <ul className="space-y-1 ml-2">
                      <li>• Full Go rules implementation</li>
                      <li>• Territory scoring</li>
                      <li>• SGF import/export</li>
                      <li>• Move validation & hints</li>
                      <li>• Sound effects</li>
                      <li>• AI opponent (Easy/Medium)</li>
                      <li>• Multiple board sizes (9×9, 13×13, 19×19)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Score Modal */}
      <ScoreModal />
      
      {/* Capture Animation Overlay */}
      {animatingCaptures.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-40">
          {animatingCaptures.map(([row, col], index) => {
            const boardDisplaySize = 500;
            const cellSize = boardDisplaySize / (boardSize - 1);
            return (
              <div
                key={`capture-${row}-${col}-${index}`}
                className="absolute w-8 h-8 bg-red-500 rounded-full animate-ping opacity-75"
                style={{
                  left: col * cellSize + boardDisplaySize / 2 - 250,
                  top: row * cellSize + 100, // Adjust based on your layout
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GoBoard;
