const suits = [
  { key: 'S', symbol: '♠', name: 'Spades', red: false },
  { key: 'H', symbol: '♥', name: 'Hearts', red: true },
  { key: 'D', symbol: '♦', name: 'Diamonds', red: true },
  { key: 'C', symbol: '♣', name: 'Clubs', red: false },
];
const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const rankValue = { A: 14, K: 13, Q: 12, J: 11, '10': 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };
const deck = suits.flatMap(suit => ranks.map(rank => ({ ...suit, rank, value: rankValue[rank], id: `${rank}${suit.key}` })));
const state = { players: null, phase: 'setup', hole: [], flop: [], turn: null, isCalculating: false };
const screens = ['setup-screen', 'cards-screen', 'odds-screen'];
const phaseDetails = {
  hole: { kicker: 'YOUR HAND', title: 'Select your two private cards', instruction: 'Tap two cards. A card can only be used once.', target: 2, progress: 'hole', next: 'flop' },
  flop: { kicker: 'COMMUNITY CARDS', title: 'Select the three flop cards', instruction: 'Tap the flop exactly as it appeared on the table.', target: 3, progress: 'flop', next: 'turnEquity' },
  turn: { kicker: 'TURN CARD', title: 'Select the fourth community card', instruction: 'Tap the actual turn card, then see which river cards help you most.', target: 1, progress: 'turn', next: 'riverEquity' },
};
const $ = id => document.getElementById(id);
const redClass = card => card.red ? ' red' : '';
const cardText = card => `${card.rank}${card.symbol}`;
const hidden = id => $(id).classList.add('hidden');
const show = id => $(id).classList.remove('hidden');
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const usedCards = () => [...state.hole, ...state.flop, ...(state.turn ? [state.turn] : [])];
const formatPercent = value => `${value.toFixed(1)}%`;

function remainingCards(extra = []) {
  const known = new Set([...usedCards(), ...extra].map(card => card.id));
  return deck.filter(card => !known.has(card.id));
}
function sampleCount() {
  const opponents = Math.max(0, state.players - 1);
  return opponents <= 1 ? 520 : opponents <= 4 ? 360 : 240;
}
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
    ? selected.map(card => `<span class="card-token${redClass(card)}">${cardText(card)}</span>`).join('')
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
      return `<button class="card${redClass(card)}${selected ? ' selected' : ''}" type="button" data-card="${card.id}" aria-label="${card.rank} of ${card.name}" ${disabled ? 'disabled' : ''}>${card.rank}</button>`;
    }).join('');
    return `<div class="suit-row"><span class="suit-label${suit.red ? ' red' : ''}" aria-label="${suit.name}">${suit.symbol}</span>${cards}</div>`;
  }).join('');
  document.querySelectorAll('[data-card]').forEach(button => button.addEventListener('click', () => {
    const card = deck.find(item => item.id === button.dataset.card);
    const selected = currentSelection();
    setCurrentSelection(selected.some(item => item.id === card.id) ? selected.filter(item => item.id !== card.id) : [...selected, card]);
    renderCardScreen();
  }));
}
function renderCardScreen() {
  const details = phaseDetails[state.phase];
  $('card-section-kicker').textContent = details.kicker;
  $('card-title').textContent = details.title;
  $('card-instruction').textContent = details.instruction;
  $('continue-button').disabled = currentSelection().length !== details.target;
  $('continue-button').textContent = state.phase === 'turn' ? 'Rank river cards' : 'Continue';
  $('back-button').textContent = state.phase === 'hole' ? 'Change players' : 'Back';
  renderSelected(); renderDeck(); setProgress(details.progress);
}
function startPhase(phase) { state.phase = phase; switchScreen('cards-screen'); renderCardScreen(); }

// A higher five-card score wins. The first value is the hand category, then tie breakers.
function scoreFive(cards) {
  const values = cards.map(card => card.value).sort((a, b) => b - a);
  const counts = new Map(); values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || b.value - a.value);
  const flush = cards.every(card => card.key === cards[0].key);
  const unique = [...new Set(values)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straightHigh = unique[0];
    else if (unique.join(',') === '14,5,4,3,2') straightHigh = 5;
  }
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0].count === 4) return [7, groups[0].value, groups[1].value];
  if (groups[0].count === 3 && groups[1].count === 2) return [6, groups[0].value, groups[1].value];
  if (flush) return [5, ...values];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].count === 3) return [3, groups[0].value, ...groups.slice(1).map(group => group.value).sort((a, b) => b - a)];
  if (groups[0].count === 2 && groups[1].count === 2) return [2, Math.max(groups[0].value, groups[1].value), Math.min(groups[0].value, groups[1].value), groups[2].value];
  if (groups[0].count === 2) return [1, groups[0].value, ...groups.slice(1).map(group => group.value).sort((a, b) => b - a)];
  return [0, ...values];
}
function compareScores(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0); if (diff) return Math.sign(diff);
  }
  return 0;
}
function bestScore(cards) {
  let best = null;
  for (let a = 0; a < cards.length - 4; a += 1) for (let b = a + 1; b < cards.length - 3; b += 1)
    for (let c = b + 1; c < cards.length - 2; c += 1) for (let d = c + 1; d < cards.length - 1; d += 1)
      for (let e = d + 1; e < cards.length; e += 1) {
        const score = scoreFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
        if (!best || compareScores(score, best) > 0) best = score;
      }
  return best;
}
function dealRandom(pool, count) {
  const dealt = pool.slice();
  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (dealt.length - index));
    [dealt[index], dealt[swapIndex]] = [dealt[swapIndex], dealt[index]];
  }
  return dealt.slice(0, count);
}
function candidateEquity(candidate, stage, samples) {
  const opponents = Math.max(0, state.players - 1); if (!opponents) return 100;
  let equity = 0;
  for (let trial = 0; trial < samples; trial += 1) {
    const pool = remainingCards([candidate]); let board; let opponentCards;
    if (stage === 'turn') {
      const dealt = dealRandom(pool, 1 + opponents * 2); board = [...state.flop, candidate, dealt[0]]; opponentCards = dealt.slice(1);
    } else { board = [...state.flop, state.turn, candidate]; opponentCards = dealRandom(pool, opponents * 2); }
    const scores = [bestScore([...state.hole, ...board])];
    for (let player = 0; player < opponents; player += 1) scores.push(bestScore([opponentCards[player * 2], opponentCards[player * 2 + 1], ...board]));
    let top = scores[0]; scores.forEach(score => { if (compareScores(score, top) > 0) top = score; });
    const tiedWinners = scores.filter(score => compareScores(score, top) === 0).length;
    if (compareScores(scores[0], top) === 0) equity += 1 / tiedWinners;
  }
  return equity * 100 / samples;
}
function renderRanking(results) {
  $('odds-list').innerHTML = results.map((result, index) => `
    <div class="equity-card${index === 0 ? ' top-card' : ''}${redClass(result.card)}">
      <span class="equity-rank">${index + 1}</span>
      <span class="equity-name">${cardText(result.card)}<small>Draw chance: ${result.drawChance}</small></span>
      <span class="equity-value">${formatPercent(result.equity)}</span>
    </div>`).join('');
}
async function showEquityRanking(stage) {
  state.isCalculating = true;
  const candidates = remainingCards(); const samples = sampleCount(); const isTurn = stage === 'turn';
  setProgress(isTurn ? 'turn' : 'river');
  $('odds-kicker').textContent = isTurn ? 'TURN IMPACT' : 'RIVER IMPACT';
  $('odds-title').textContent = `Which ${isTurn ? 'turn' : 'river'} cards help you most?`;
  $('odds-fraction').textContent = 'Calculating';
  $('odds-explanation').textContent = `Ranking ${candidates.length} cards by estimated showdown equity.`;
  $('odds-assumption').textContent = `Assumes ${Math.max(0, state.players - 1)} random opponent${state.players === 2 ? '' : 's'} and that everyone reaches showdown. Every physical card is still equally likely to be dealt.`;
  $('odds-list').innerHTML = ''; $('calculation-status').textContent = 'Preparing simulations…';
  $('odds-next-button').disabled = true; $('odds-next-button').textContent = 'Calculating…'; $('fold-button').disabled = true;
  switchScreen('odds-screen'); await pause();
  const drawChance = formatPercent(100 / candidates.length); const results = [];
  for (let index = 0; index < candidates.length; index += 1) {
    results.push({ card: candidates[index], equity: candidateEquity(candidates[index], stage, samples), drawChance });
    if (index % 3 === 2 || index === candidates.length - 1) { $('calculation-status').textContent = `Analysing card ${index + 1} of ${candidates.length}…`; await pause(); }
  }
  results.sort((a, b) => b.equity - a.equity); renderRanking(results);
  const best = results[0]; const worst = results[results.length - 1];
  $('odds-fraction').textContent = `${formatPercent(best.equity)} best`;
  $('odds-explanation').textContent = `${cardText(best.card)} is best; ${cardText(worst.card)} is worst at ${formatPercent(worst.equity)} equity.`;
  $('calculation-status').textContent = `Estimated from ${samples.toLocaleString()} random showdowns per card.`;
  $('odds-next-button').disabled = false; $('fold-button').disabled = false;
  $('odds-next-button').textContent = isTurn ? 'Enter the actual turn' : 'Start next hand';
  $('odds-next-button').onclick = () => isTurn ? startPhase('turn') : resetHand();
  state.isCalculating = false;
}
function resetHand() {
  if (state.isCalculating) return;
  state.players = null; state.phase = 'setup'; state.hole = []; state.flop = []; state.turn = null;
  $('start-button').disabled = true; renderPlayerPicker(); setProgress('setup'); switchScreen('setup-screen');
}
$('start-button').addEventListener('click', () => startPhase('hole'));
$('continue-button').addEventListener('click', async () => {
  if (state.isCalculating) return;
  const next = phaseDetails[state.phase].next;
  if (next === 'turnEquity') await showEquityRanking('turn'); else if (next === 'riverEquity') await showEquityRanking('river'); else startPhase(next);
});
$('back-button').addEventListener('click', async () => {
  if (state.isCalculating) return;
  if (state.phase === 'hole') { switchScreen('setup-screen'); setProgress('setup'); }
  else if (state.phase === 'flop') startPhase('hole'); else await showEquityRanking('turn');
});
$('reset-button').addEventListener('click', resetHand);
$('fold-button').addEventListener('click', resetHand);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
renderPlayerPicker();

