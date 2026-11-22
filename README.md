# Hold'em Odds

An offline, mobile-first Texas Hold'em equity calculator. It asks for the number of players, your two cards, the flop, and later the turn. It ranks every possible next community card by your estimated chance to win at showdown.

## Run it locally

Serve this folder with any local static server, then open it in a browser. For example, with Node.js installed:

```powershell
npx serve .
```

For the offline-installable PWA behaviour, open it from a local or hosted HTTP(S) server rather than by double-clicking `index.html`.

## What the ranking means

Each unseen physical card remains equally likely to be drawn: `1/47` on the turn and `1/46` on the river. Therefore, the app does **not** falsely rank cards by their chance of appearing.

Instead, it evaluates each candidate turn or river using offline Monte Carlo simulations against uniformly random hidden opponent hands. It ranks cards by the hero's estimated showdown equity: a card is high in the list when it is more helpful to your hand, and low when it is dangerous. It assumes every selected player reaches showdown; it does not infer betting ranges or folded hands.

