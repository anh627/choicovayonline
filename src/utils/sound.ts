let audioContext: AudioContext | null = null;

export const playSound = (soundType: 'place' | 'capture' | 'pass' | 'invalid') => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  const frequencies = {
    place: 800,
    capture: 400,
    pass: 600,
    invalid: 200
  };
  
  oscillator.frequency.setValueAtTime(frequencies[soundType], audioContext.currentTime);
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
};
