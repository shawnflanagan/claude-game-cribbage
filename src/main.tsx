import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html has no #root element');
}

// `?seed=123` pins the first Game so a browser test replays the same Round.
// A saved Game still takes precedence; the seed only applies to a fresh start.
const seedParam = new URLSearchParams(window.location.search).get('seed');
const seed =
  seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : undefined;

createRoot(root).render(
  <StrictMode>{seed === undefined ? <App /> : <App seed={seed} />}</StrictMode>,
);
