import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { SkipForward, Volume2, VolumeX } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const VideoIntro = ({ onComplete, videoUrl, soundEnabled = false }) => {
  const [showSkip, setShowSkip] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Always start muted for autoplay
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(soundEnabled); // Show prompt if sound should be on
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef(null);
  const hasCompletedRef = useRef(false);
  const MAX_RETRIES = 2;

  // Construct full video URL - handle relative and absolute paths
  const fullVideoUrl = videoUrl?.startsWith('http') 
    ? videoUrl 
    : videoUrl?.startsWith('/') 
      ? `${API_URL}${videoUrl}`
      : `${API_URL}/${videoUrl}`;

  const handleComplete = useCallback(() => {
    if (hasCompletedRef.current || fadeOut) return; // Prevent double-trigger
    hasCompletedRef.current = true;
    setFadeOut(true);
    // Wait for fade animation to complete
    setTimeout(() => {
      onComplete();
    }, 500);
  }, [fadeOut, onComplete]);

  // Toggle mute/unmute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
      setShowUnmutePrompt(false); // Hide prompt after user interaction
    }
  }, []);

  useEffect(() => {
    // Show skip button after 1 second
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 1000);

    // Fallback auto-complete after 12 seconds if video doesn't end/error
    const completeTimer = setTimeout(() => {
      handleComplete();
    }, 12000);

    // Hide unmute prompt after 3 seconds
    const unmuteTimer = setTimeout(() => {
      setShowUnmutePrompt(false);
    }, 4000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(completeTimer);
      clearTimeout(unmuteTimer);
    };
  }, [handleComplete]);

  // Handle video playback with retry logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const attemptPlay = async () => {
      try {
        // Must start muted for autoplay to work in browsers
        video.muted = true;
        video.playsInline = true;
        await video.play();
        setIsPlaying(true);
        setVideoLoaded(true);
        setIsMuted(true);
      } catch (error) {
        console.warn('Video autoplay failed:', error);
        // Still mark as loaded so user can see skip option
        setVideoLoaded(true);
      }
    };

    // Listen for when video can play
    const handleCanPlay = () => {
      setVideoLoaded(true);
      attemptPlay();
    };

    const handleCanPlayThrough = () => {
      attemptPlay();
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);

    // If video already has data, try to play
    if (video.readyState >= 3) {
      attemptPlay();
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [videoUrl, retryCount]);

  const handleVideoEnd = () => {
    handleComplete();
  };

  const handleVideoError = (e) => {
    const video = videoRef.current;
    const errorCode = video?.error?.code;
    const errorMessage = video?.error?.message || 'Unknown error';
    console.error('Video error:', { errorCode, errorMessage, src: fullVideoUrl, retry: retryCount });
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying video load (${retryCount + 1}/${MAX_RETRIES})...`);
      setRetryCount(prev => prev + 1);
      // Force reload by updating the video src
      if (video) {
        video.load();
      }
      return;
    }
    
    setVideoError(true);
    // Skip intro if video fails after retries
    setTimeout(() => {
      handleComplete();
    }, 1000);
  };

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
  };

  const handleVideoPlaying = () => {
    setIsPlaying(true);
    setVideoLoaded(true);
  };

  // If no video URL provided, skip intro immediately
  useEffect(() => {
    if (!videoUrl) {
      handleComplete();
    }
  }, [videoUrl, handleComplete]);

  if (!videoUrl) {
    return null;
  }

  // Add cache-busting for retries
  const videoSrc = retryCount > 0 
    ? `${fullVideoUrl}${fullVideoUrl.includes('?') ? '&' : '?'}retry=${retryCount}` 
    : fullVideoUrl;

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      data-testid="video-intro"
    >
      {/* Video - Fullscreen, show full video (letterbox on mobile) */}
      {!videoError ? (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: 'contain',
            objectPosition: 'center center'
          }}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
          onLoadedMetadata={handleVideoLoaded}
          onPlaying={handleVideoPlaying}
          data-testid="intro-video-element"
        />
      ) : (
        <div className="text-white text-center">
          <p className="text-lg opacity-50">Loading...</p>
        </div>
      )}

      {/* Loading indicator while video loads */}
      {!videoLoaded && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Sound/Mute Toggle Button - Bottom Left */}
      {videoLoaded && !videoError && (
        <div className="absolute bottom-8 left-8 z-10 animate-fade-in flex items-center gap-3">
          <Button
            variant="outline"
            onClick={toggleMute}
            className="bg-black/50 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white transition-all"
            data-testid="sound-toggle-button"
          >
            {isMuted ? (
              <>
                <VolumeX className="h-4 w-4 mr-2" />
                Unmute
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 mr-2" />
                Mute
              </>
            )}
          </Button>
          
          {/* Unmute prompt - shows briefly if sound is enabled in settings */}
          {showUnmutePrompt && isMuted && (
            <span className="text-white/80 text-sm animate-pulse">
              Tap to hear audio
            </span>
          )}
        </div>
      )}

      {/* Skip Button - Bottom Right */}
      {showSkip && (
        <div className="absolute bottom-8 right-8 z-10 animate-fade-in">
          <Button
            variant="outline"
            onClick={handleComplete}
            className="bg-black/50 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:text-white transition-all"
            data-testid="skip-intro-button"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip Intro
          </Button>
        </div>
      )}

      {/* Progress indicator - uses actual video duration when available */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
        <div 
          className="h-full bg-red-500 transition-all ease-linear"
          style={{ 
            animation: `progressBar ${isPlaying ? '6s' : '12s'} linear forwards`
          }}
        />
      </div>

      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default VideoIntro;
