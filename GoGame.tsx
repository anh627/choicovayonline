/**
 * GoGame.tsx
 * Main component for the Go game with advanced AI and features
 * Watermark: GoGame_v4_2025_https://github.com/anh627
 * License: MIT
 */
import React, { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Board from './Board';
import GameControls from './GameControls';
import GameSettings from './GameSettings';
import MoveHistory from './MoveHistory';
import Statistics from './Statistics';
import Rules from './Rules';
import ScoreModal from './ScoreModal';
import AnalysisPanel from './AnalysisPanel';
import TrainingMode from './TrainingMode';
import { useGameLogic } from './useGameLogic';
import './styles.css';

// Phần còn lại của file giữ nguyên
const GoGame: React.FC = () => {
  const {
    board,
    currentPlayer,
    blackCaptures,
    whiteCaptures,
    gameStatus,
    moveHistory,
    passCount,
    timer,
    showScore,
    showTerritory,
    invalidMoveMessage,
    isThinking,
    boardSize,
    gameMode,
    difficulty,
    handicap,
    trainingMode,
    setBoardSize,
    setGameMode,
    setDifficulty,
    setHandicap,
    setUseTimer,
    setTrainingMode,
    handleStonePlacement,
    handlePass,
    resetGame,
    undoMove,
    exportSGF,
    loadSGF,
    makeAIMove,
    toggleTerritory,
    useTimer,
  } = useGameLogic();

  useEffect(() => {
    console.log(`GoGame v4 initialized. Watermark: GoGame_v4_2025_YourName`);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 py-8 px-4">
      <ToastContainer />
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">GoMaster Pro v4</h1>
          <p className="text-center text-gray-600 mb-6">Advanced Go with enhanced AI and training mode</p>

          <GameSettings
            boardSize={boardSize}
            gameMode={gameMode}
            difficulty={difficulty}
            handicap={handicap}
            useTimer={useTimer}
            trainingMode={trainingMode}
            setBoardSize={setBoardSize}
            setGameMode={setGameMode}
            setDifficulty={setDifficulty}
            setHandicap={setHandicap}
            setUseTimer={setUseTimer}
            setTrainingMode={setTrainingMode}
            moveHistory={moveHistory}
          />

          {invalidMoveMessage && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center">
              {invalidMoveMessage}
            </div>
          )}

          <div className="flex flex-col xl:flex-row gap-8">
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
              <Board
                board={board}
                currentPlayer={currentPlayer}
                handleStonePlacement={handleStonePlacement}
                boardSize={boardSize}
                showTerritory={showTerritory}
              />
            </div>
            <div className="xl:w-80">
              <GameControls
                gameStatus={gameStatus}
                currentPlayer={currentPlayer}
                passCount={passCount}
                isThinking={isThinking}
                handlePass={handlePass}
                undoMove={undoMove}
                resetGame={resetGame}
                makeAIMove={makeAIMove}
                toggleTerritory={toggleTerritory}
                exportSGF={exportSGF}
                loadSGF={loadSGF}
                moveHistory={moveHistory}
                gameMode={gameMode}
              />
              {trainingMode && <TrainingMode board={board} makeAIMove={makeAIMove} />}
              <AnalysisPanel board={board} moveHistory={moveHistory} currentPlayer={currentPlayer} />
              <Statistics moveHistory={moveHistory} blackCaptures={blackCaptures} whiteCaptures={whiteCaptures} />
              <MoveHistory moveHistory={moveHistory} boardSize={boardSize} />
              <Rules />
            </div>
          </div>
        </div>
      </div>
      <ScoreModal
        showScore={showScore}
        gameScore={calculateScore(board, blackCaptures, whiteCaptures, boardSize)}
        resetGame={resetGame}
      />
    </div>
  );
};

export default GoGame;
