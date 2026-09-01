import React, { useState, useEffect } from 'react';
import { Lobby } from './components/Lobby';
import { Dashboard } from './components/Dashboard';
import { PlayerId } from './types';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  useEffect(() => {
    // Check local storage for existing session
    const savedRoomId = localStorage.getItem('ustwo_roomId');
    const savedRoomCode = localStorage.getItem('ustwo_roomCode');
    const savedPlayerId = localStorage.getItem('ustwo_playerId') as PlayerId;
    const savedPlayerName = localStorage.getItem('ustwo_playerName');

    if (savedRoomId && savedRoomCode && savedPlayerId && savedPlayerName) {
      setRoomId(savedRoomId);
      setRoomCode(savedRoomCode);
      setPlayerId(savedPlayerId);
      setPlayerName(savedPlayerName);
    }
  }, []);

  const handleJoin = (id: string, code: string, player: PlayerId, name: string) => {
    setRoomId(id);
    setRoomCode(code);
    setPlayerId(player);
    setPlayerName(name);
    
    localStorage.setItem('ustwo_roomId', id);
    localStorage.setItem('ustwo_roomCode', code);
    localStorage.setItem('ustwo_playerId', player);
    localStorage.setItem('ustwo_playerName', name);
  };

  const handleLeave = () => {
    setRoomId(null);
    setRoomCode(null);
    setPlayerId(null);
    setPlayerName(null);
    localStorage.removeItem('ustwo_roomId');
    localStorage.removeItem('ustwo_roomCode');
    localStorage.removeItem('ustwo_playerId');
    localStorage.removeItem('ustwo_playerName');
  };

  if (roomId && roomCode && playerId && playerName) {
    return (
      <Dashboard 
        roomId={roomId} 
        roomCode={roomCode} 
        playerId={playerId} 
        playerName={playerName}
        onLeave={handleLeave} 
      />
    );
  }

  return <Lobby onJoin={handleJoin} />;
}
