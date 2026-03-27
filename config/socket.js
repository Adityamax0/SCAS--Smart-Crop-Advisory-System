const socketIo = require('socket.io');

let io;

/**
 * Initialize Socket.io with the HTTP server
 */
const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN?.split(',') || []
        : ['http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // Join room based on user role and district
    socket.on('join_district', (district) => {
      if (district) {
        const room = `district:${district.toLowerCase()}`;
        socket.join(room);
        console.log(`[SOCKET] User ${socket.id} joined room: ${room}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get the initialized IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Please call initSocket(server) first.');
  }
  return io;
};

/**
 * Utility to notify workers in a district about a new ticket
 */
const notifyNewTicket = (district, ticketData) => {
  if (!io) return;
  const room = `district:${district.toLowerCase()}`;
  io.to(room).emit('new_ticket', {
    success: true,
    message: 'A new distress call has arrived in your district!',
    data: ticketData,
  });
  console.log(`[SOCKET] Emitted new_ticket to room: ${room}`);
};

module.exports = { 
  initSocket, 
  getIO, 
  getSocket: getIO, // Alias for compatibility with older controllers
  notifyNewTicket 
};
