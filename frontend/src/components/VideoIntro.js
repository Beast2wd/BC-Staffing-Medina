import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { SkipForward } from 'lucide-react';

export const VideoIntro = ({ onComplete }) => {
  const [showSkip, setShowSkip] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Show skip button after 1 second
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 1000);

    // Auto-complete after 6 seconds
    const completeTimer = setTimeout(() => {
      handleComplete();
    }, 6000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  const handleComplete = () => {
    setFadeOut(true);
    // Wait for fade animation to complete
    setTimeout(() => {
      // Mark intro as seen in session storage
      sessionStorage.setItem('introSeen', 'true');
      onComplete();
    }, 500);
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      data-testid="video-intro"
    >
      {/* YouTube Video Embed - Fullscreen */}
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src="https://www.youtube.com/embed/A5eES30o87Q?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=A5eES30o87Q"
          title="BC Staffing Intro"
          className="w-full h-full object-cover"
          style={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: '100%',
            minHeight: '100%',
            width: 'auto',
            height: 'auto'
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          frameBorder="0"
        />
      </div>

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
      `}</style>
    </div>
  );
};

export default VideoIntro;
