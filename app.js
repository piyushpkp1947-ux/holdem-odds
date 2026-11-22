const suits = [
  { key: 'S', symbol: '♠', name: 'Spades', red: false },
  { key: 'H', symbol: '♥', name: 'Hearts', red: true },
  { key: 'D', symbol: '♦', name: 'Diamonds', red: true },
  { key: 'C', symbol: '♣', name: 'Clubs', red: false },
];
const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const deck = suits.flatMap(suit => ranks.map(rank => ({ ...suit, rank, id: `${rank}${suit.key}` })));

const state = { players: null, phase: 'setup', hole: [], flop: [], turn: null };
const screens = ['setup-screen', 'cards-screen', 'odds-screen'];
const phaseDetails = {
  hole: { kicker: 'YOUR HAND', title: 'Select your two private cards', instruction: 'Tap two cards. A card can only be used once.', target: 2, progress: 'hole', next: 'flop' },
  flop: { kicker: 'COMMUNITY CARDS', title: 'Select the three flop cards', instruction: 'Tap the flop exactly as it appeared on the table.', target: 3, progress: 'flop', next: 'turnOdds' },
  turn: { kicker: 'TURN CARD', title: 'Select the fourth community card', instruction: 'Tap the turn card now that it is visible.', target: 1, progress: 'turn', next: 'riverOdds' },
};

const $ = id => document.getElementById(id);
const isRed = card => card.red ? ' red' : '';
const cardText = card => `${card.rank}${card.symbol}`;
const usedCards = () => [...state.hole, ...state.flop, ...(state.turn ? [state.turn] : [])];
const hidden = id => $(id).classList.add('hidden');
const show = id => $(id).classList.remove('hidden');

function renderPlayerPicker() {
  $('player-picker').innerHTML = Array.from({ length: 10 }, (_, index) => {
    const count = index + 1;
    return `<button class="number-button" type="button" data-players="${count}" aria-pressed="false">${count}</button>`;
  }).join('');
  document.querySelectorAll('[data-players]').forEach(button => button.addEventListener('click', () => {
    state.players = Number(button.dataset.players);
    document.querySelectorAll('[data-players]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    $('start-button').disabled = false;
  }));
}

function setProgress(active) {
  const order = ['setup', 'hole', 'flop', 'turn', 'river'];
  document.querySelectorAll('[data-progress]').forEach(item => {
    const position = order.indexOf(item.dataset.progress);
    const current = order.indexOf(active);
    item.classList.toggle('active', position === current);
    item.classList.toggle('done', position < current);
  });
}

function switchScreen(id) {
  screens.forEach(hidden);
  show(id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function currentSelection() {
  if (state.phase === 'hole') return state.hole;
  if (state.phase === 'flop') return state.flop;
  return state.turn ? [state.turn] : [];
}

function setCurrentSelection(cards) {
  if (state.phase === 'hole') state.hole = cards;
  else if (state.phase === 'flop') state.flop = cards;
  else state.turn = cards[0] || null;
}

function renderSelected() {
  const selected = currentSelection();
  $('selected-cards').innerHTML = selected.length
    ? selected.map(card => `<span class="card-token${isRed(card)}">${cardText(card)}</span>`).join('')
    : '<span class="placeholder">No cards selected yet</span>';
}

function renderDeck() {
  const details = phaseDetails[state.phase];
  const selectedIds = new Set(currentSelection().map(card => card.id));
  const blockedIds = new Set(usedCards().filter(card => !selectedIds.has(card.id)).map(card => card.id));
  $('deck').innerHTML = suits.map(suit => {
    const cards = deck.filter(card => card.key === suit.key).map(card => {
      const selected = selectedIds.has(card.id);
      const disabled = blockedIds.has(card.id) || (!selected && currentSelection().length >= details.target);
      return `<button class="card${isRed(card)}${selected ? ' selected' : ''}" type="button" data-card="${card.id}" aria-label="${card.rank} of ${card.name}" ${disabled ? 'disabled' : ''}>${card.rank}</button>`;
    }).join('');
    return `<div class="suit-row"><span class="suit-label${suit.red ? ' red' : ''}" aria-label="${suit.name}">${suit.symbol}</span>${cards}</div>`;
  }).join('');
  document.querySelectorAll('[data-card]').forEach(button => button.addEventListener('click', () => {
    const card = deck.find(item => item.id === button.dataset.card);
    const selected = currentSelection();
    const alreadySelected = selected.some(item => item.id === card.id);
    setCurrentSelection(alreadySelected ? selected.filter(item => item.id !== card.id) : [...selected, card]);
    renderCardScreen();
  }));
}

function renderCardScreen() {
  const details = phaseDetails[state.phase];
  $('card-section-kicker').textContent = details.kicker;
  $('card-title').textContent = details.title;
  $('card-instruction').textContent = details.instruction;
  $('continue-button').disabled = currentSelection().length !== details.target;
  $('continue-button').textContent = state.phase === 'turn' ? 'See river possibilities' : 'Continue';
  $('back-button').textContent = state.phase === 'hole' ? 'Change players' : 'Back';
  renderSelected();
  renderDeck();
  setProgress(details.progress);
}

function startPhase(phase) {
  state.phase = phase;
  switchScreen('cards-screen');
  renderCardScreen();
}

function remainingCards() {
  const known = new Set(usedCards().map(card => card.id));
  return deck.filter(card => !known.has(card.id));
}

function renderOdds(kind) {
  const possibilities = remainingCards();
  const isTurn = kind === 'turn';
  setProgress(isTurn ? 'turn' : 'river');
  $('odds-kicker').textContent = isTurn ? 'TURN PROBABILITIES' : 'RIVER PROBABILITIES';
  $('odds-title').textContent = isTurn ? 'Every unseen card is a possible turn' : 'Every remaining card is a possible river';
  $('odds-fraction').textContent = `1 in ${possibilities.length}`;
  $('odds-explanation').textContent = `Each possible ${isTurn ? 'turn' : 'river'} card has a ${formatPercent(1 / possibilities.length)} chance.`;
  $('odds-list').innerHTML = possibilities.map(card => `<div class="odd-card${isRed(card)}"><span>${cardText(card)}</span><small>${formatPercent(1 / possibilities.length)}</small></div>`).join('');
  $('odds-next-button').textContent = isTurn ? 'Enter the turn card' : 'Start next hand';
  $('odds-next-button').onclick = () => isTurn ? startPhase('turn') : resetHand();
  switchScreen('odds-screen');
}

function formatPercent(value) { return `${(value * 100).toFixed(2)}%`; }

function resetHand() {
  state.players = null;
  state.phase = 'setup';
  state.hole = [];
  state.flop = [];
  state.turn = null;
  $('start-button').disabled = true;
  renderPlayerPicker();
  setProgress('setup');
  switchScreen('setup-screen');
}

$('start-button').addEventListener('click', () => startPhase('hole'));
$('continue-button').addEventListener('click', () => {
  const next = phaseDetails[state.phase].next;
  if (next === 'turnOdds') renderOdds('turn');
  else if (next === 'riverOdds') renderOdds('river');
  else startPhase(next);
});
$('back-button').addEventListener('click', () => {
  if (state.phase === 'hole') { switchScreen('setup-screen'); setProgress('setup'); }
  if (state.phase === 'flop') startPhase('hole');
  if (state.phase === 'turn') renderOdds('turn');
});
$('reset-button').addEventListener('click', resetHand);

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
renderPlayerPicker();
