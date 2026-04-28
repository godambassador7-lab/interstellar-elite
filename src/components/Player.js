// src/components/Player.js
// Re-exports PlayerShip from GameCanvas for modular access

export { PlayerShip as Player } from './GameCanvas';
export { createPlayer, createAbilities, updatePlayer, triggerDash, triggerPulse, triggerDrone } from '../systems/PlayerSystem';
