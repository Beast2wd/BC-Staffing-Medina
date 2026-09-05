import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  Mic, Play, Pause, Search, Filter, Clock, User, 
  FileText, CheckCircle2, Circle, Loader2, Trash2,
  ChevronDown, ChevronUp, MessageSquare, Building2
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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
  const [expandedId, setExpandedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  
  const audioRef = useRef(null);

  useEffect(() => {
    fetchFeedback();
    fetchStats();
  }, [statusFilter]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
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

  const updateStatus = async (id, newStatus, notes = null) => {
    try {
      setUpdatingId(id);
      const params = new URLSearchParams();
      params.append('status', newStatus);
      if (notes !== null) {
        params.append('admin_notes', notes);
      }

      await axios.put(
        `${API_URL}/api/voice-feedback/${id}/status?${params.toString()}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Status updated');
      fetchFeedback();
      fetchStats();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
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
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
          <Mic className="h-8 w-8 text-red-500" />
          Voice Feedback Dashboard
        </h1>
        <p className="text-zinc-400 mt-1">
          {isSuperAdmin ? 'Review feedback from all tenants' : 'Review feedback from your team'}
        </p>
      </div>

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
              <SelectTrigger className="w-full sm:w-48 bg-zinc-900 border-zinc-700 text-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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
          {feedback.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedId === item.id;
            
            return (
              <Card 
                key={item.id} 
                className="bg-zinc-800/50 border-zinc-700 overflow-hidden"
              >
                <CardContent className="p-0">
                  {/* Main Row */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-zinc-700/30 transition-colors"
                    onClick={() => handleExpand(item.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge className={`${statusConfig.color} text-white`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
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
  );
};

export default VoiceFeedbackDashboard;
