// src/components/Enemy.js
// Re-exports EnemyShip from GameCanvas for modular access

export { EnemyShip as Enemy } from './GameCanvas';
export { trySpawn, updateEnemyMovement } from '../systems/SpawnSystem';
