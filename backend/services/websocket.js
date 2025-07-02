const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

// Store active connections
const connections = new Map();

// Store room memberships
const rooms = new Map();

// Setup WebSocket server
function setupWebSocketServer(wss) {
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Store connection with a temporary ID until authenticated
    const tempConnectionId = Date.now().toString();
    connections.set(tempConnectionId, { ws, userId: null, authenticated: false });
    
    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        const connectionInfo = getConnectionByWs(ws);
        
        if (!connectionInfo) {
          console.error('Connection not found in connections map');
          return;
        }
        
        // Handle different message types
        switch (data.type) {
          case 'AUTH':
            await handleAuth(connectionInfo, data, tempConnectionId);
            break;
            
          case 'JOIN_ROOM':
            handleJoinRoom(connectionInfo, data);
            break;
            
          case 'LEAVE_ROOM':
            handleLeaveRoom(connectionInfo, data);
            break;
            
          case 'PANEL_UPDATE':
            handlePanelUpdate(connectionInfo, data);
            break;
            
          default:
            console.log(`Unhandled message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      cleanupConnection(ws);
      console.log('WebSocket client disconnected');
    });
  });
}

// Handle authentication
async function handleAuth(connectionInfo, data, tempConnectionId) {
  try {
    // Get user ID from message - handle both formats
    const userId = data.userId || (data.data && data.data.userId);
    
    if (!userId) {
      console.error('No user ID provided for authentication');
      console.error('Received data:', JSON.stringify(data, null, 2));
      return;
    }
    
    // Verify user exists in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      console.error(`User not found: ${userId}`);
      
      // Send failure message to client
      try {
        connectionInfo.ws.send(JSON.stringify({
          type: 'AUTH_FAILURE',
          data: { error: 'User not found in database' }
        }));
      } catch (sendError) {
        console.error('Failed to send auth failure message:', sendError);
      }
      return;
    }
    
    // Update connection info
    connectionInfo.userId = userId;
    connectionInfo.authenticated = true;
    
    // Remove temporary connection entry and add with user ID as key
    connections.delete(tempConnectionId);
    connections.set(userId, connectionInfo);
    
    // Send success message
    connectionInfo.ws.send(JSON.stringify({
      type: 'AUTH_SUCCESS',
      message: 'Successfully authenticated'
    }));
    
    console.log(`User ${userId} authenticated via WebSocket`);
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Send failure message to client
    try {
      connectionInfo.ws.send(JSON.stringify({
        type: 'AUTH_FAILURE',
        data: { error: error.message || 'Authentication failed' }
      }));
    } catch (sendError) {
      console.error('Failed to send auth failure message:', sendError);
    }
  }
}

// Handle join room
function handleJoinRoom(connectionInfo, data) {
  if (!connectionInfo.authenticated) {
    console.error('Unauthenticated client tried to join room');
    return;
  }
  
  // Handle both formats
  const room = data.room || (data.data && data.data.room);
  
  if (!room) {
    console.error('No room specified');
    console.error('Received data:', JSON.stringify(data, null, 2));
    return;
  }
  
  // Add user to room
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  
  rooms.get(room).add(connectionInfo.userId);
  
  console.log(`User ${connectionInfo.userId} joined room ${room}`);
  
  // Notify user they joined the room
  connectionInfo.ws.send(JSON.stringify({
    type: 'ROOM_JOINED',
    room,
  }));
}

// Handle leave room
function handleLeaveRoom(connectionInfo, data) {
  if (!connectionInfo.authenticated) return;
  
  // Handle both formats
  const room = data.room || (data.data && data.data.room);
  
  if (!room || !rooms.has(room)) return;
  
  // Remove user from room
  rooms.get(room).delete(connectionInfo.userId);
  
  // Clean up empty rooms
  if (rooms.get(room).size === 0) {
    rooms.delete(room);
  }
  
  console.log(`User ${connectionInfo.userId} left room ${room}`);
}

// Handle panel update
function handlePanelUpdate(connectionInfo, data) {
  if (!connectionInfo.authenticated) return;
  
  // Handle both formats
  const projectId = data.projectId || (data.data && data.data.projectId);
  
  if (!projectId) return;
  
  // Broadcast to all users in the room except sender
  wsSendToRoom(`panel_layout_${projectId}`, data, connectionInfo.userId);
}

// Send message to all users in a room
function wsSendToRoom(room, message, excludeUserId = null) {
  if (!rooms.has(room)) return;
  
  const roomMembers = rooms.get(room);
  
  for (const userId of roomMembers) {
    // Skip the sender if excludeUserId is provided
    if (excludeUserId && userId === excludeUserId) {
      continue;
    }
    
    const connection = connections.get(userId);
    
    if (connection && connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(message));
    }
  }
}

// Get connection info by WebSocket instance
function getConnectionByWs(ws) {
  for (const [id, info] of connections.entries()) {
    if (info.ws === ws) {
      return info;
    }
  }
  return null;
}

// Clean up when a connection closes
function cleanupConnection(ws) {
  // Find the connection
  const connectionInfo = getConnectionByWs(ws);
  
  if (!connectionInfo) return;
  
  // If authenticated, remove from all rooms
  if (connectionInfo.authenticated && connectionInfo.userId) {
    for (const [roomName, members] of rooms.entries()) {
      if (members.has(connectionInfo.userId)) {
        members.delete(connectionInfo.userId);
        
        // Clean up empty rooms
        if (members.size === 0) {
          rooms.delete(roomName);
        }
      }
    }
    
    // Remove from connections
    connections.delete(connectionInfo.userId);
  } else {
    // Find and remove by checking each entry
    for (const [id, info] of connections.entries()) {
      if (info.ws === ws) {
        connections.delete(id);
        break;
      }
    }
  }
}

module.exports = { setupWebSocketServer, wsSendToRoom };
