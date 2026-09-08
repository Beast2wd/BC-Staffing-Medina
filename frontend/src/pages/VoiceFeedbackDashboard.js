import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { AudioWaveform } from '../components/ui/audio-waveform';
import { toast } from 'sonner';
import { 
  Mic, Play, Pause, Search, Filter, Clock, User, 
  FileText, CheckCircle2, Circle, Loader2, Trash2,
  ChevronDown, ChevronUp, MessageSquare, Building2,
  Square, Send, X, MicOff
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Platform sections/pages for dropdown
const PLATFORM_SECTIONS = [
  { value: 'dashboard', label: 'Dashboard / Daily Worksheet' },
  { value: 'on-duty', label: 'On Duty View' },
  { value: 'apparatus', label: 'Apparatus Assignment' },
  { value: 'leave-management', label: 'Leave Management' },
  { value: 'leave-calendar', label: 'Leave Calendar' },
  { value: 'leave-balance', label: 'Leave Balance Dashboard' },
  { value: 'overtime', label: 'Overtime Management' },
  { value: 'volunteer', label: 'Volunteer Management' },
  { value: 'part-time', label: 'Part-Time Management' },
  { value: 'deployments', label: 'Deployments' },
  { value: 'deployment-roster', label: 'Deployment Roster' },
  { value: 'deployment-history', label: 'Deployment History' },
  { value: 'personnel', label: 'Personnel Management' },
  { value: 'user-management', label: 'User Management' },
  { value: 'station-management', label: 'Station Management' },
  { value: 'reports', label: 'Reports' },
  { value: 'branding', label: 'Branding Settings' },
  { value: 'calendar', label: 'Calendar View' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'settings', label: 'Settings' },
  { value: 'general', label: 'General / Other' }
];

// Feedback categories
const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug Report', color: 'bg-red-500', icon: '🐛' },
  { value: 'feature', label: 'Feature Request', color: 'bg-purple-500', icon: '✨' },
  { value: 'ui', label: 'UI Improvement', color: 'bg-blue-500', icon: '🎨' },
  { value: 'performance', label: 'Performance Issue', color: 'bg-orange-500', icon: '⚡' },
  { value: 'question', label: 'Question / Help', color: 'bg-cyan-500', icon: '❓' },
  { value: 'other', label: 'Other', color: 'bg-zinc-500', icon: '📝' }
];

// Priority levels
const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-slate-500', textColor: 'text-slate-300', icon: '▽' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-600', textColor: 'text-yellow-300', icon: '◆' },
  { value: 'high', label: 'High', color: 'bg-orange-600', textColor: 'text-orange-300', icon: '▲' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-600', textColor: 'text-red-300', icon: '🔥' }
];

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-500', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle2 }
};

export const VoiceFeedbackDashboard = () => {
  const { token, user } = useAuth();
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState({ new: 0, in_progress: 0, completed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  
  // Recording state
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('medium');
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  // Audio data for expanded items
  const [expandedAudioData, setExpandedAudioData] = useState({});
  const [loadingAudioId, setLoadingAudioId] = useState(null);
  
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    fetchFeedback();
    fetchStats();
  }, [statusFilter, priorityFilter]);
  
  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (priorityFilter && priorityFilter !== 'all') {
        params.append('priority', priorityFilter);
      }
      if (searchQuery) {
        params.append('page_name', searchQuery);
      }

      const response = await axios.get(
        `${API_URL}/api/voice-feedback/list?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedback(response.data.feedback || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/voice-feedback/stats/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchFeedbackDetails = async (id) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/voice-feedback/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching feedback details:', error);
      toast.error('Failed to load audio');
      return null;
    }
  };

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
    } else {
      setExpandedId(id);
      
      // Fetch audio data if not already loaded
      if (!expandedAudioData[id]) {
        setLoadingAudioId(id);
        const details = await fetchFeedbackDetails(id);
        if (details && details.audio_data) {
          const audioBlob = base64ToBlob(details.audio_data, details.audio_content_type || 'audio/webm');
          const audioUrl = URL.createObjectURL(audioBlob);
          setExpandedAudioData(prev => ({
            ...prev,
            [id]: { blob: audioBlob, url: audioUrl }
          }));
        }
        setLoadingAudioId(null);
      }
    }
  };

  const handlePlayAudio = async (item) => {
    if (playingId === item.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
      return;
    }

    // Fetch full details with audio
    const details = await fetchFeedbackDetails(item.id);
    if (details && details.audio_data) {
      // Convert base64 to audio
      const audioBlob = base64ToBlob(details.audio_data, details.audio_content_type || 'audio/webm');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setPlayingId(item.id);
        
        audioRef.current.onended = () => {
          setPlayingId(null);
        };
      }
    }
  };

  const base64ToBlob = (base64, contentType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  };

  const updateStatus = async (id, newStatus, notes = null, priority = null) => {
    try {
      setUpdatingId(id);
      const params = new URLSearchParams();
      params.append('status', newStatus);
      if (notes !== null) {
        params.append('admin_notes', notes);
      }
      if (priority !== null) {
        params.append('priority', priority);
      }

      await axios.put(
        `${API_URL}/api/voice-feedback/${id}/status?${params.toString()}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(priority ? 'Priority updated' : 'Status updated');
      fetchFeedback();
      fetchStats();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteFeedback = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      await axios.delete(
        `${API_URL}/api/voice-feedback/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Feedback deleted');
      fetchFeedback();
      fetchStats();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      toast.error('Failed to delete feedback');
    }
  };

  // Recording functions
  const startRecording = async () => {
    if (!selectedSection) {
      toast.error('Please select a section first');
      return;
    }
    
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
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
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
    setSelectedSection('');
    setSelectedCategory('');
    setSelectedPriority('medium');
    setIsRecordingOpen(false);
  };

  // Audio compression function
  const compressAudio = async (blob) => {
    // For browsers that support AudioContext, we can compress
    // For now, we'll just ensure the blob is reasonable size
    // If the blob is larger than 5MB, we'll warn but still send
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (blob.size > maxSize) {
      toast.warning('Audio file is large. Compressing may take longer.');
    }
    
    // Return the blob as-is for now (WebM is already compressed)
    // Future enhancement: use AudioContext to resample/compress
    return blob;
  };

  const submitRecording = async () => {
    if (!audioBlob || !selectedSection || !selectedCategory) {
      toast.error('Please select a section, category, and record audio');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Compress audio before upload
      const compressedAudio = await compressAudio(audioBlob);
      
      const sectionLabel = PLATFORM_SECTIONS.find(s => s.value === selectedSection)?.label || selectedSection;
      const categoryLabel = FEEDBACK_CATEGORIES.find(c => c.value === selectedCategory)?.label || selectedCategory;
      
      const formData = new FormData();
      const filename = `feedback_${Date.now()}.webm`;
      formData.append('audio', compressedAudio, filename);
      formData.append('page_name', sectionLabel);
      formData.append('page_url', `/${selectedSection}`);
      formData.append('category', selectedCategory);
      formData.append('priority', selectedPriority);

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
        
        // Refresh the list
        fetchFeedback();
        fetchStats();
        
        // Reset after showing transcript
        setTimeout(() => {
          setAudioBlob(null);
          setTranscript('');
          setRecordingTime(0);
          setSelectedSection('');
          setSelectedCategory('');
          setSelectedPriority('medium');
          setIsRecordingOpen(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk selection functions
  const toggleSelectAll = () => {
    if (selectedIds.length === feedback.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(feedback.map(f => f.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const bulkUpdateStatus = async (newStatus) => {
    if (selectedIds.length === 0) {
      toast.error('No items selected');
      return;
    }

    setIsBulkUpdating(true);
    
    try {
      // Update each selected item
      const updatePromises = selectedIds.map(id => 
        axios.put(
          `${API_URL}/api/voice-feedback/${id}/status?status=${newStatus}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      await Promise.all(updatePromises);
      
      toast.success(`${selectedIds.length} item(s) updated to ${STATUS_CONFIG[newStatus].label}`);
      setSelectedIds([]);
      fetchFeedback();
      fetchStats();
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update some items');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isSuperAdmin = user?.is_super_admin;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        {/* Hidden audio element */}
        <audio ref={audioRef} className="hidden" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <Mic className="h-8 w-8 text-red-500" />
            Voice Feedback Dashboard
          </h1>
          <p className="text-zinc-400 mt-1">
            {isSuperAdmin ? 'Review feedback from all tenants' : 'Review feedback from your team'}
          </p>
        </div>
        
        {/* New Feedback Button */}
        <Button
          onClick={() => setIsRecordingOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
          data-testid="new-feedback-btn"
        >
          <Mic className="h-5 w-5" />
          New Voice Feedback
        </Button>
      </div>

      {/* Recording Modal */}
      {isRecordingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">New Voice Feedback</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelRecording}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Section Selector */}
            <div className="mb-4">
              <Label className="text-zinc-300 text-sm mb-2 block">Select Platform Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={isRecording || audioBlob}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Choose a section to report about..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {PLATFORM_SECTIONS.map((section) => (
                    <SelectItem key={section.value} value={section.value}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Selector */}
            <div className="mb-4">
              <Label className="text-zinc-300 text-sm mb-2 block">Feedback Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isRecording || audioBlob}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="What type of feedback is this?" />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Selector */}
            <div className="mb-4">
              <Label className="text-zinc-300 text-sm mb-2 block">Priority Level</Label>
              <div className="flex gap-2">
                {PRIORITY_LEVELS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    variant={selectedPriority === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPriority(p.value)}
                    disabled={isRecording || audioBlob}
                    className={
                      selectedPriority === p.value
                        ? `${p.color} text-white border-transparent`
                        : `border-zinc-600 ${p.textColor} hover:${p.color} hover:text-white hover:border-transparent`
                    }
                  >
                    <span className="mr-1">{p.icon}</span>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Selected Section Info */}
            {selectedSection && selectedCategory && (
              <div className="bg-zinc-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-zinc-400">Recording feedback for:</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white font-medium flex items-center gap-1">
                    <span>{FEEDBACK_CATEGORIES.find(c => c.value === selectedCategory)?.icon}</span>
                    {PLATFORM_SECTIONS.find(s => s.value === selectedSection)?.label}
                  </span>
                  <Badge className={`${PRIORITY_LEVELS.find(p => p.value === selectedPriority)?.color} text-white text-xs`}>
                    {PRIORITY_LEVELS.find(p => p.value === selectedPriority)?.icon} {PRIORITY_LEVELS.find(p => p.value === selectedPriority)?.label}
                  </Badge>
                </div>
              </div>
            )}

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
                  disabled={!selectedSection || !selectedCategory}
                  className={`w-24 h-24 rounded-full transition-all duration-200 ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                      : (selectedSection && selectedCategory)
                        ? 'bg-zinc-700 hover:bg-zinc-600' 
                        : 'bg-zinc-800 cursor-not-allowed'
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
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <MicOff className="h-5 w-5" />
                    <span>Recording complete ({formatTime(recordingTime)})</span>
                  </div>
                  
                  {/* Audio Preview with Waveform */}
                  <div className="w-full bg-zinc-800 rounded-lg p-3">
                    <AudioWaveform audioBlob={audioBlob} />
                  </div>
                </div>
              )}

              {/* Instructions */}
              <p className="text-zinc-400 text-sm mt-4 text-center">
                {(!selectedSection || !selectedCategory)
                  ? 'Select a section and category above to start'
                  : isRecording 
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
                  onClick={submitRecording}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">New</p>
                <p className="text-2xl font-bold text-blue-400">{stats.new}</p>
              </div>
              <Circle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">In Progress</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.in_progress}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Completed</p>
                <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-zinc-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-800/50 border-zinc-700 mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search by page name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchFeedback()}
                  className="pl-10 bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-zinc-900 border-zinc-700 text-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-zinc-900 border-zinc-700 text-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {PRIORITY_LEVELS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={fetchFeedback}
              className="bg-red-600 hover:bg-red-700"
            >
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <Card className="bg-zinc-800 border-zinc-600 mb-4">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-zinc-300 text-sm font-medium">
                {selectedIds.length} selected
              </span>
              <div className="flex-1" />
              <span className="text-zinc-400 text-sm">Bulk update to:</span>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <Button
                  key={status}
                  size="sm"
                  variant="outline"
                  onClick={() => bulkUpdateStatus(status)}
                  disabled={isBulkUpdating}
                  className={`border-zinc-600 hover:${config.color} hover:text-white`}
                >
                  {isBulkUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    config.label
                  )}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="text-zinc-400 hover:text-white"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </div>
      ) : feedback.length === 0 ? (
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardContent className="p-8 text-center">
            <Mic className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No feedback found</p>
            <p className="text-zinc-500 text-sm mt-1">
              Voice feedback from admins will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Select All Row */}
          <div className="flex items-center gap-3 px-2">
            <input
              type="checkbox"
              checked={selectedIds.length === feedback.length && feedback.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-500"
            />
            <span className="text-zinc-400 text-sm">Select all</span>
          </div>

          {feedback.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
            const StatusIcon = statusConfig.icon;
            const categoryConfig = FEEDBACK_CATEGORIES.find(c => c.value === item.category) || FEEDBACK_CATEGORIES[5];
            const priorityConfig = PRIORITY_LEVELS.find(p => p.value === item.priority) || PRIORITY_LEVELS[1];
            const isExpanded = expandedId === item.id;
            const isSelected = selectedIds.includes(item.id);
            
            return (
              <Card 
                key={item.id} 
                className={`bg-zinc-800/50 border-zinc-700 overflow-hidden ${isSelected ? 'ring-2 ring-red-500' : ''}`}
              >
                <CardContent className="p-0">
                  {/* Main Row */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-zinc-700/30 transition-colors"
                    onClick={() => handleExpand(item.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Checkbox */}
                      <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-500"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {/* Priority Badge - First */}
                          <Badge className={`${priorityConfig.color} text-white`}>
                            <span className="mr-1">{priorityConfig.icon}</span>
                            {priorityConfig.label}
                          </Badge>
                          
                          <Badge className={`${statusConfig.color} text-white`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          
                          {/* Category Badge */}
                          <Badge className={`${categoryConfig.color} text-white`}>
                            <span className="mr-1">{categoryConfig.icon}</span>
                            {categoryConfig.label}
                          </Badge>
                          
                          <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                            <FileText className="h-3 w-3 mr-1" />
                            {item.page_name}
                          </Badge>
                          
                          {isSuperAdmin && item.tenant_name && (
                            <Badge variant="outline" className="border-blue-600 text-blue-300">
                              <Building2 className="h-3 w-3 mr-1" />
                              {item.tenant_name}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-white text-sm line-clamp-2 mb-2">
                          {item.transcript || '[No transcript available]'}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {item.user_name} ({item.user_role})
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayAudio(item);
                          }}
                          className="text-zinc-400 hover:text-white"
                        >
                          {playingId === item.id ? (
                            <Pause className="h-5 w-5" />
                          ) : (
                            <Play className="h-5 w-5" />
                          )}
                        </Button>
                        
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-700 p-4 bg-zinc-900/50">
                      <div className="grid gap-4">
                        {/* Audio Waveform */}
                        <div>
                          <Label className="text-zinc-400 text-sm mb-2 block">Audio Recording</Label>
                          <div className="bg-zinc-800 rounded-lg p-3">
                            {loadingAudioId === item.id ? (
                              <div className="flex items-center justify-center h-16">
                                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                                <span className="ml-2 text-zinc-400">Loading audio...</span>
                              </div>
                            ) : expandedAudioData[item.id] ? (
                              <AudioWaveform
                                audioUrl={expandedAudioData[item.id].url}
                                onPlayStateChange={(playing) => setPlayingId(playing ? item.id : null)}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-16 text-zinc-500">
                                <span>Audio not available</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Full Transcript */}
                        <div>
                          <Label className="text-zinc-400 text-sm">Full Transcript</Label>
                          <div className="mt-1 p-3 bg-zinc-800 rounded-lg text-white text-sm">
                            {item.transcript || '[No transcript available]'}
                          </div>
                        </div>
                        
                        {/* Admin Notes */}
                        <div>
                          <Label className="text-zinc-400 text-sm">Admin Notes</Label>
                          <Textarea
                            placeholder="Add notes about this feedback..."
                            defaultValue={item.admin_notes || ''}
                            className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                            id={`notes-${item.id}`}
                          />
                        </div>
                        
                        {/* Priority Update */}
                        <div>
                          <Label className="text-zinc-400 text-sm mb-2 block">Priority Level</Label>
                          <div className="flex gap-2 flex-wrap">
                            {PRIORITY_LEVELS.map((p) => (
                              <Button
                                key={p.value}
                                size="sm"
                                variant={item.priority === p.value ? 'default' : 'outline'}
                                onClick={() => {
                                  const notes = document.getElementById(`notes-${item.id}`)?.value;
                                  updateStatus(item.id, item.status, notes, p.value);
                                }}
                                disabled={updatingId === item.id}
                                className={
                                  item.priority === p.value
                                    ? `${p.color} text-white`
                                    : `border-zinc-600 ${p.textColor} hover:${p.color} hover:text-white`
                                }
                              >
                                <span className="mr-1">{p.icon}</span>
                                {p.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="text-zinc-400 text-sm mr-2">Update Status:</Label>
                          
                          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                            <Button
                              key={status}
                              size="sm"
                              variant={item.status === status ? 'default' : 'outline'}
                              onClick={() => {
                                const notes = document.getElementById(`notes-${item.id}`)?.value;
                                updateStatus(item.id, status, notes);
                              }}
                              disabled={updatingId === item.id}
                              className={
                                item.status === status 
                                  ? `${config.color} text-white` 
                                  : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'
                              }
                            >
                              {updatingId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                config.label
                              )}
                            </Button>
                          ))}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteFeedback(item.id)}
                            className="border-red-600 text-red-400 hover:bg-red-600/20 ml-auto"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

export default VoiceFeedbackDashboard;
