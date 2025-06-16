/**
 * WebSocket client for real-time updates
 * This utility manages WebSocket connections for real-time updates to submission statuses
 */

// Use the actual WebSocket API URL from AWS API Gateway
const WS_API_URL = process.env.NEXT_PUBLIC_WEBSOCKET_API_URL || 'wss://6g4l7w4jz5.execute-api.us-west-2.amazonaws.com/dev';

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface WebSocketMessage {
  action?: string;
  submissionId?: string;
  data?: any;
  body?: string | any; // API Gateway often wraps the message in a body property
}

class WebSocketClient {
  private socket: WebSocket | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private submissionSubscriptions: Set<string> = new Set();
  
  // Singleton pattern
  private static instance: WebSocketClient;
  
  private constructor() {}
  
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }
  
  public connect(authToken?: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket is already connected or connecting');
      return;
    }
    
    try {
      // Add authentication token as query parameter if available
      const url = authToken 
        ? `${WS_API_URL}?token=${encodeURIComponent(authToken)}` 
        : WS_API_URL;
      
      this.socket = new WebSocket(url);
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
        
        // Resubscribe to any submissions that were previously subscribed
        this.submissionSubscriptions.forEach(submissionId => {
          this.subscribeToSubmission(submissionId);
        });
        
        // Notify connection handlers
        this.connectionHandlers.forEach(handler => handler());
      };
      
      this.socket.onmessage = (event) => {
        try {
          console.log('WebSocket message received:', event.data);
          let message: WebSocketMessage;
          
          try {
            message = JSON.parse(event.data) as WebSocketMessage;
          } catch (parseError) {
            console.error('Error parsing WebSocket message:', parseError, 'Raw data:', event.data);
            return;
          }
          
          // Log the parsed message for debugging
          console.log('Parsed WebSocket message:', message);
          
          // Handle both direct action messages and messages that might be wrapped in a body property
          // (common in API Gateway WebSocket integrations)
          const action = message.action || (message.body && typeof message.body === 'string' ? JSON.parse(message.body).action : null);
          const submissionId = message.submissionId || (message.body && typeof message.body === 'string' ? JSON.parse(message.body).submissionId : null);
          const data = message.data || (message.body && typeof message.body === 'string' ? JSON.parse(message.body).data : null);
          
          if (action && this.messageHandlers.has(action)) {
            console.log(`Processing message with action: ${action}, submissionId: ${submissionId}`);
            const handlers = this.messageHandlers.get(action);
            handlers?.forEach(handler => {
              try {
                // Create a normalized message format for handlers
                const normalizedMessage = {
                  action,
                  submissionId,
                  data
                };
                handler(normalizedMessage);
              } catch (handlerError) {
                console.error('Error in message handler:', handlerError);
              }
            });
          } else {
            console.log(`No handlers registered for action: ${action || 'undefined'}`);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error, 'Raw data:', event.data);
        }
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.socket?.close();
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.attemptReconnect();
    }
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached');
      return;
    }
    
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    console.log(`Attempting to reconnect in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
  
  public subscribeToSubmission(submissionId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Add to subscription set to resubscribe when connection is established
      this.submissionSubscriptions.add(submissionId);
      this.connect();
      return;
    }
    
    const message: WebSocketMessage = {
      action: 'subscribe',
      submissionId
    };
    
    this.socket.send(JSON.stringify(message));
    this.submissionSubscriptions.add(submissionId);
  }
  
  public unsubscribeFromSubmission(submissionId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message: WebSocketMessage = {
      action: 'unsubscribe',
      submissionId
    };
    
    this.socket.send(JSON.stringify(message));
    this.submissionSubscriptions.delete(submissionId);
  }
  
  public onMessage(action: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(action)) {
      this.messageHandlers.set(action, new Set());
    }
    
    const handlers = this.messageHandlers.get(action)!;
    handlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(action);
      }
    };
  }
  
  public onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }
  
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const webSocketClient = typeof window !== 'undefined' ? WebSocketClient.getInstance() : null;

// Hook for using WebSocket in React components
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAuthSession } from 'aws-amplify/auth';

export function useWebSocketSubscription(submissionId: string, onUpdate: (data: any) => void) {
  const { isAuthenticated } = useAuth();
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  
  // Get authentication token
  const getAuthToken = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const { tokens } = await fetchAuthSession();
        setAuthToken(tokens?.idToken?.toString());
      } catch (error) {
        console.error('Error fetching auth token:', error);
      }
    }
  }, [isAuthenticated]);
  
  // Get token when authentication status changes
  useEffect(() => {
    getAuthToken();
  }, [getAuthToken]);
  
  // Connect to WebSocket and subscribe to updates
  useEffect(() => {
    // Only run on client-side
    if (!webSocketClient) return;
    
    // Connect to WebSocket with auth token and subscribe to submission updates
    webSocketClient.connect(authToken);
    webSocketClient.subscribeToSubmission(submissionId);
    
    // Listen for submission update events
    const unsubscribe = webSocketClient.onMessage('submissionUpdate', (message) => {
      if (message.submissionId === submissionId) {
        onUpdate(message.data);
      }
    });
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      webSocketClient.unsubscribeFromSubmission(submissionId);
    };
  }, [submissionId, onUpdate, authToken]);
}
