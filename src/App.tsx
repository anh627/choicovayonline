// src/App.tsx
import React from 'react';
import GoBoard from './components/GoBoard';
import './App.css'; // nếu bạn có file CSS (tuỳ chọn)

function App() {
  return (
    <div className="App">
      <GoBoard />
    </div>
  );
}

export default App;
