import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Mic, MicOff, Loader2, X, Send, Square } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Map routes to friendly page names
const PAGE_NAMES = {
  '/dashboard': 'Dashboard',
  '/daily-worksheet': 'Daily Worksheet',
  '/apparatus': 'Apparatus Assignment',
  '/leave-management': 'Leave Management',
  '/leave-calendar': 'Leave Calendar',
  '/leave-balance': 'Leave Balance Dashboard',
  '/overtime': 'Overtime Management',
  '/volunteer': 'Volunteer Management',
  '/part-time-bc': 'Part-Time Management',
  '/deployments': 'Deployments',
  '/deployment-roster': 'Deployment Roster',
  '/deployment-log': 'Deployment Log',
  '/deployment-history': 'Deployment History',
  '/tifmas-rank': 'TIFMAS Rank',
  '/emtf-rank': 'EMTF Rank',
  '/on-duty': 'On Duty View',
  '/calendar': 'Calendar View',
  '/personnel': 'Personnel Management',
  '/user-management': 'User Management',
  '/station-management': 'Station Management',
  '/volunteer-management': 'Volunteer Management',
  '/part-time-management': 'Part-Time Management',
  '/branding': 'Branding Settings',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  '/overtime-availability': 'Overtime Availability',
  '/volunteer-availability': 'Volunteer Availability',
  '/part-time-availability': 'Part-Time Availability'
};

export const VoiceFeedbackButton = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Only show for admin roles
  const canSubmitFeedback = user && ['admin', 'deputy_chief', 'battalion_chief'].includes(user.role);
  
  // Don't show on public pages
  const isPublicPage = ['/', '/login', '/client-login', '/medina-county-login', '/platform-settings', '/super-admin'].includes(location.pathname);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getPageName = () => {
    return PAGE_NAMES[location.pathname] || location.pathname.replace(/\//g, ' ').trim() || 'Unknown Page';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setTranscript('');
    setRecordingTime(0);
    setIsOpen(false);
  };

  const submitFeedback = async () => {
    if (!audioBlob) {
      toast.error('No recording to submit');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      const filename = `feedback_${Date.now()}.webm`;
      formData.append('audio', audioBlob, filename);
      formData.append('page_name', getPageName());
      formData.append('page_url', location.pathname);

      const response = await axios.post(
        `${API_URL}/api/voice-feedback/submit`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setTranscript(response.data.transcript);
        toast.success('Feedback submitted successfully!');
        
        // Show transcript briefly then close
        setTimeout(() => {
          setAudioBlob(null);
          setTranscript('');
          setRecordingTime(0);
          setIsOpen(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!canSubmitFeedback || isPublicPage) {
    return null;
  }

  return (
    <>
      {/* Floating Mic Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all duration-200 hover:scale-110"
        data-testid="voice-feedback-btn"
      >
        <Mic className="h-6 w-6" />
      </Button>

      {/* Recording Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Voice Feedback</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelRecording}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Page Info */}
            <div className="bg-zinc-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-zinc-400">Recording feedback for:</p>
              <p className="text-white font-medium">{getPageName()}</p>
            </div>

            {/* Recording Area */}
            <div className="flex flex-col items-center py-6">
              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 font-mono">{formatTime(recordingTime)}</span>
                </div>
              )}

              {/* Main Record Button */}
              {!audioBlob ? (
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-24 h-24 rounded-full transition-all duration-200 ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                      : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                  data-testid="record-btn"
                >
                  {isRecording ? (
                    <Square className="h-10 w-10 text-white" />
                  ) : (
                    <Mic className="h-10 w-10 text-white" />
                  )}
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <MicOff className="h-5 w-5" />
                    <span>Recording complete ({formatTime(recordingTime)})</span>
                  </div>
                  
                  {/* Audio Preview */}
                  <audio 
                    controls 
                    src={URL.createObjectURL(audioBlob)} 
                    className="w-full"
                  />
                </div>
              )}

              {/* Instructions */}
              <p className="text-zinc-400 text-sm mt-4 text-center">
                {isRecording 
                  ? 'Speak clearly about the changes you want...' 
                  : audioBlob 
                    ? 'Review your recording and submit' 
                    : 'Tap the mic to start recording'}
              </p>
            </div>

            {/* Transcript Preview */}
            {transcript && (
              <div className="bg-zinc-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-zinc-400 mb-1">Transcript:</p>
                <p className="text-white text-sm">{transcript}</p>
              </div>
            )}

            {/* Action Buttons */}
            {audioBlob && !transcript && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAudioBlob(null);
                    setRecordingTime(0);
                  }}
                  className="flex-1 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                  disabled={isSubmitting}
                >
                  Re-record
                </Button>
                <Button
                  onClick={submitFeedback}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={isSubmitting}
                  data-testid="submit-feedback-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceFeedbackButton;
