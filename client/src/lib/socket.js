import { io } from 'socket.io-client';
import { API_URL, tokenStore } from './api';

let socket = null;

export function getSocket() {
  const token = tokenStore.get();
  if (!token) return null;
  if (socket && socket.auth?.token === token) return socket;
  if (socket) socket.disconnect();
  socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
