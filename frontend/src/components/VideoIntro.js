import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { SkipForward } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const VideoIntro = ({ onComplete, videoUrl }) => {
  const [showSkip, setShowSkip] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    // Show skip button after 1 second
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 1000);

    // Auto-complete after 6 seconds (fallback if video doesn't trigger onEnded)
    const completeTimer = setTimeout(() => {
      handleComplete();
    }, 7000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  const handleComplete = () => {
    if (fadeOut) return; // Prevent double-trigger
    setFadeOut(true);
    // Wait for fade animation to complete
    setTimeout(() => {
      // Mark intro as seen in session storage
      sessionStorage.setItem('introSeen', 'true');
      onComplete();
    }, 500);
  };

  const handleVideoEnd = () => {
    handleComplete();
  };

  const handleVideoError = () => {
    console.error('Video failed to load');
    setVideoError(true);
    // Skip intro if video fails
    setTimeout(() => {
      handleComplete();
    }, 1000);
  };

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
  };

  // If no video URL provided, skip intro immediately
  useEffect(() => {
    if (!videoUrl) {
      handleComplete();
    }
  }, [videoUrl]);

  if (!videoUrl) {
    return null;
  }

  // Construct full video URL
  const fullVideoUrl = videoUrl.startsWith('http') ? videoUrl : `${API_URL}${videoUrl}`;

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      data-testid="video-intro"
    >
      {/* Video - Fullscreen, no controls, autoplay */}
      {!videoError ? (
        <video
          ref={videoRef}
          src={fullVideoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
        />
      ) : (
        <div className="text-white text-center">
          <p className="text-lg">Loading...</p>
        </div>
      )}

      {/* Loading indicator while video loads */}
      {!videoLoaded && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Skip Button */}
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

      {/* Progress indicator */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
        <div 
          className="h-full bg-red-500 transition-all ease-linear"
          style={{ 
            animation: 'progressBar 6s linear forwards'
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
