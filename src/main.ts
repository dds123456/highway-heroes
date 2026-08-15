import './styles/main.css';
import { Game } from './core/Game';

const game = new Game();

window.addEventListener('load', () => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.transition = 'opacity 0.4s ease';
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 500);
  }
});

void game;
