import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Get settings from localStorage (avoid circular dependency with SettingsContext)
const getToastSettings = () => {
  try {
    const saved = localStorage.getItem('userSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        showToasts: settings.showRealtimeToasts !== false,
        duration: settings.toastDuration || 5000
      };
    }
  } catch {}
  return { showToasts: true, duration: 5000 };
};

export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const subscribedChannelsRef = useRef(new Set());
  const eventListenersRef = useRef(new Map());

  const getWebSocketUrl = useCallback(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    
    // Convert HTTP URL to WebSocket URL
    let wsUrl = backendUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    
    wsUrl = `${wsUrl}/api/ws`;
    if (token) {
      wsUrl += `?token=${token}`;
    }
    
    return wsUrl;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log('WebSocket connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Re-subscribe to previously subscribed channels
        if (subscribedChannelsRef.current.size > 0) {
          const channels = Array.from(subscribedChannelsRef.current);
          ws.send(JSON.stringify({ action: 'subscribe', channels }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Handle different message types
          if (data.type === 'connected') {
            console.log('WebSocket authenticated:', data.authenticated);
          } else if (data.type === 'subscribed') {
            console.log('Subscribed to channels:', data.channels);
          } else if (data.type === 'pong') {
            // Heartbeat response
          } else {
            // Broadcast to all registered listeners for this event type
            const listeners = eventListenersRef.current.get(data.type) || [];
            listeners.forEach(callback => callback(data));

            // Also broadcast to 'all' listeners
            const allListeners = eventListenersRef.current.get('all') || [];
            allListeners.forEach(callback => callback(data));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [getWebSocketUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const subscribe = useCallback((channels) => {
    const channelArray = Array.isArray(channels) ? channels : [channels];
    channelArray.forEach(ch => subscribedChannelsRef.current.add(ch));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', channels: channelArray }));
    }
  }, []);

  const unsubscribe = useCallback((channels) => {
    const channelArray = Array.isArray(channels) ? channels : [channels];
    channelArray.forEach(ch => subscribedChannelsRef.current.delete(ch));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'unsubscribe', channels: channelArray }));
    }
  }, []);

  const addEventListener = useCallback((eventType, callback) => {
    if (!eventListenersRef.current.has(eventType)) {
      eventListenersRef.current.set(eventType, []);
    }
    eventListenersRef.current.get(eventType).push(callback);

    // Return cleanup function
    return () => {
      const listeners = eventListenersRef.current.get(eventType) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, []);

  const value = {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    addEventListener,
    sendMessage,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook for subscribing to specific update types
export const useRealtimeUpdates = (channels, onUpdate) => {
  const { subscribe, unsubscribe, addEventListener, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to channels
    subscribe(channels);

    // Listen for all update types
    const cleanupFunctions = [];

    const handleUpdate = (data) => {
      if (onUpdate) {
        onUpdate(data);
      }
    };

    // Listen to specific event types based on channels
    const eventTypes = {
      staffing: ['staffing_update', 'apparatus_update'],
      overtime: ['overtime_update'],
      personnel: ['personnel_update'],
      volunteer: ['volunteer_update'],
      parttime: ['parttime_update'],
      deployments: ['deployment_update'],
      all: ['all'],
    };

    const channelArray = Array.isArray(channels) ? channels : [channels];
    channelArray.forEach(channel => {
      const types = eventTypes[channel] || [];
      types.forEach(type => {
        const cleanup = addEventListener(type, handleUpdate);
        cleanupFunctions.push(cleanup);
      });
    });

    return () => {
      unsubscribe(channels);
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [channels, onUpdate, subscribe, unsubscribe, addEventListener, isConnected]);

  return { isConnected };
};

// Hook specifically for staffing page updates
export const useStaffingUpdates = (date, onUpdate) => {
  const { isConnected, addEventListener, subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    subscribe('staffing');

    const handleStaffingUpdate = (data) => {
      // Only trigger update if it's for the current date
      if (data.date === date || !data.date) {
        if (onUpdate) {
          onUpdate(data);
        }
        
        // Show toast notification for updates from other users (if enabled)
        const { showToasts, duration } = getToastSettings();
        if (showToasts && data.data?.modified_by) {
          const stationInfo = data.data?.station_id ? ` (Station ${data.data.station_id.replace('sta-', '')})` : '';
          
          if (data.event === 'updated') {
            toast.info(`Staffing updated by ${data.data.modified_by}${stationInfo}`, {
              description: 'Data refreshed automatically.',
              duration,
            });
          } else if (data.event === 'created') {
            toast.info(`New staffing record created by ${data.data.modified_by}${stationInfo}`, {
              duration,
            });
          }
        }
        
        // Apparatus updates
        if (showToasts && data.type === 'apparatus_update' && data.data?.apparatus_name) {
          const modifierInfo = data.data?.modified_by ? ` by ${data.data.modified_by}` : '';
          if (data.event === 'updated') {
            toast.info(`${data.data.apparatus_name} assignments updated${modifierInfo}`, {
              description: 'Apparatus assignments refreshed.',
              duration,
            });
          } else if (data.event === 'created') {
            toast.info(`New apparatus assignment: ${data.data.apparatus_name}${modifierInfo}`, {
              duration,
            });
          }
        }
      }
    };

    const cleanup1 = addEventListener('staffing_update', handleStaffingUpdate);
    const cleanup2 = addEventListener('apparatus_update', handleStaffingUpdate);

    return () => {
      unsubscribe('staffing');
      cleanup1();
      cleanup2();
    };
  }, [date, onUpdate, isConnected, addEventListener, subscribe, unsubscribe]);

  return { isConnected };
};

// Hook specifically for overtime page updates
export const useOvertimeUpdates = (date, onUpdate) => {
  const { isConnected, addEventListener, subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    subscribe('overtime');

    const handleOvertimeUpdate = (data) => {
      if (data.date === date || !data.date) {
        if (onUpdate) {
          onUpdate(data);
        }
        
        // Show toast notification (if enabled)
        const { showToasts, duration } = getToastSettings();
        if (showToasts) {
          const modifierInfo = data.data?.modified_by ? ` by ${data.data.modified_by}` : '';
          if (data.event === 'created' && data.data?.personnel_name) {
            toast.info(`New overtime: ${data.data.personnel_name}${modifierInfo}`, {
              description: 'Overtime availability submitted.',
              duration,
            });
          } else if (data.event === 'updated') {
            const statusMsg = data.data?.status === 'assigned' ? 'assigned' : 
                             data.data?.status === 'declined' ? 'declined' : 'updated';
            toast.info(`Overtime ${statusMsg}${modifierInfo}`, {
              description: data.data?.prev_status ? `Changed from ${data.data.prev_status}` : undefined,
              duration,
            });
          } else if (data.event === 'deleted') {
            toast.info(`Overtime record removed${modifierInfo}`, {
              duration,
            });
          }
        }
      }
    };

    const cleanup = addEventListener('overtime_update', handleOvertimeUpdate);

    return () => {
      unsubscribe('overtime');
      cleanup();
    };
  }, [date, onUpdate, isConnected, addEventListener, subscribe, unsubscribe]);

  return { isConnected };
};

export default WebSocketContext;

// Hook specifically for volunteer page updates
export const useVolunteerUpdates = (date, onUpdate) => {
  const { isConnected, addEventListener, subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    subscribe('volunteer');

    const handleVolunteerUpdate = (data) => {
      if (data.date === date || !data.date) {
        if (onUpdate) {
          onUpdate(data);
        }
        
        // Show toast notification (if enabled)
        const { showToasts, duration } = getToastSettings();
        if (showToasts) {
          const modifierInfo = data.data?.rescinded_by ? ` by ${data.data.rescinded_by}` : 
                              data.data?.modified_by ? ` by ${data.data.modified_by}` : '';
          if (data.event === 'created') {
            toast.info(`Volunteer shift added${modifierInfo}`, {
              description: 'New volunteer availability.',
              duration,
            });
          } else if (data.event === 'updated') {
            toast.info(`Volunteer shift updated${modifierInfo}`, {
              description: 'Volunteer assignment changed.',
              duration,
            });
          } else if (data.event === 'deleted') {
            toast.info(`Volunteer shift rescinded${modifierInfo}`, {
              description: 'Volunteer removed from schedule.',
              duration,
            });
          }
        }
      }
    };

    const cleanup = addEventListener('volunteer_update', handleVolunteerUpdate);

    return () => {
      unsubscribe('volunteer');
      cleanup();
    };
  }, [date, onUpdate, isConnected, addEventListener, subscribe, unsubscribe]);

  return { isConnected };
};

// Hook specifically for deployment page updates
export const useDeploymentUpdates = (onUpdate) => {
  const { isConnected, addEventListener, subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    subscribe('deployments');

    const handleDeploymentUpdate = (data) => {
      if (onUpdate) {
        onUpdate(data);
      }
      
      // Show toast notification (if enabled)
      const { showToasts, duration } = getToastSettings();
      if (showToasts) {
        const modifierInfo = data.data?.modified_by ? ` by ${data.data.modified_by}` : '';
        const deploymentName = data.data?.name || 'Deployment';
        if (data.event === 'created') {
          toast.info(`${deploymentName} created${modifierInfo}`, {
            description: 'New deployment added.',
            duration,
          });
        } else if (data.event === 'updated') {
          toast.info(`${deploymentName} updated${modifierInfo}`, {
            description: 'Deployment details changed.',
            duration,
          });
        } else if (data.event === 'deleted') {
          toast.info(`${deploymentName} removed${modifierInfo}`, {
            duration,
          });
        }
      }
    };

    const cleanup = addEventListener('deployment_update', handleDeploymentUpdate);

    return () => {
      unsubscribe('deployments');
      cleanup();
    };
  }, [onUpdate, isConnected, addEventListener, subscribe, unsubscribe]);

  return { isConnected };
};
