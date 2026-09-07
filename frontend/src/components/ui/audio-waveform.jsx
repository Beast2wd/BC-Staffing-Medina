import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '../ui/button';

export const AudioWaveform = ({ audioUrl, audioBlob, onPlayStateChange }) => {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Generate waveform data from audio
  const generateWaveform = useCallback(async (url) => {
    try {
      setIsLoading(true);
      
      // Fetch the audio file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Create audio context for analysis
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get the raw audio data
      const rawData = audioBuffer.getChannelData(0);
      const samples = 100; // Number of bars in waveform
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData = [];
      
      for (let i = 0; i < samples; i++) {
        let blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }
      
      // Normalize the data
      const maxVal = Math.max(...filteredData);
      const normalizedData = filteredData.map(val => val / maxVal);
      
      setWaveformData(normalizedData);
      setDuration(audioBuffer.duration);
      audioContext.close();
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating waveform:', error);
      setIsLoading(false);
      // Fallback to simple bars
      setWaveformData(Array(100).fill(0).map(() => Math.random() * 0.5 + 0.2));
    }
  }, []);

  // Initialize audio and generate waveform
  useEffect(() => {
    const url = audioBlob ? URL.createObjectURL(audioBlob) : audioUrl;
    if (url) {
      generateWaveform(url);
      
      // Set up audio element
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
    }
    
    return () => {
      if (audioBlob && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioUrl, audioBlob, generateWaveform]);

  // Draw waveform on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;
    const progress = duration > 0 ? currentTime / duration : 0;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw bars
    waveformData.forEach((value, index) => {
      const barHeight = value * (height * 0.8);
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      // Color based on progress
      const barProgress = index / waveformData.length;
      if (barProgress < progress) {
        ctx.fillStyle = '#ef4444'; // Red for played
      } else {
        ctx.fillStyle = '#52525b'; // Zinc for unplayed
      }
      
      // Draw rounded bar
      const radius = Math.min(barWidth * 0.3, 2);
      ctx.beginPath();
      ctx.roundRect(x + 1, y, barWidth - 2, barHeight, radius);
      ctx.fill();
    });
  }, [waveformData, currentTime, duration]);

  // Update canvas on state changes
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onPlayStateChange?.(false);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onPlayStateChange]);

  // Handle play/pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      audio.play();
      setIsPlaying(true);
      onPlayStateChange?.(true);
    }
  };

  // Handle click on waveform to seek
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || duration === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    const newTime = progress * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" preload="metadata" />
      
      {/* Play/Pause button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={togglePlay}
        disabled={isLoading}
        className="text-white hover:text-red-400 hover:bg-zinc-700 flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </Button>
      
      {/* Waveform */}
      <div className="flex-1 flex flex-col gap-1">
        <div 
          className="relative cursor-pointer"
          onClick={handleCanvasClick}
        >
          {isLoading ? (
            <div className="h-12 bg-zinc-800 rounded animate-pulse flex items-center justify-center">
              <span className="text-zinc-500 text-xs">Loading waveform...</span>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={400}
              height={48}
              className="w-full h-12 rounded"
              style={{ background: 'transparent' }}
            />
          )}
        </div>
        
        {/* Time display */}
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioWaveform;
