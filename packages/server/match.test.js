import { describe, test, expect, mock } from "bun:test";
import { resolveRound, sortCards, getInferredHumanHand, exchangeCard } from "./src/match.js";
import { createState, doExchange } from "../shared/game.js";
import { cnt } from "../shared/cards.js";

let currentMatch = null;
mock.module("./src/db.js", () => ({
  updateMatch: () => {}, findMatchById: () => currentMatch, insertMatch: () => {},
  listMatchesByOwner: () => [], listMatchesByUser: () => [], deleteMatch: () => {},
  findMatchByInviteCode: () => null, upsertUser: () => {}, getLeaderboard: () => [],
  getStorePath: () => "", db: { query: () => ({ all: () => [] }) },
}));
mock.module("./src/logger.js", () => ({
  default: { match: () => {}, info: () => {}, error: () => {}, warn: () => {} }
}));

const T = () => new Date().toISOString();

function botMatch(id, overrides = {}) {
  return { id, mode: "human-vs-bot", ownerId: "u1", status: "playing", botStrategy: "random",
    roundCount: 0, pool: [0, 1, 2, 2], history: [], pendingMoves: null,
    version: 1, createdAt: T(), updatedAt: T(), name: id,
    players: { A: { userId: "u1", hand: [0, 1, 2], losses: 0, tieEx: 0, tieCount: 0 },
               B: { userId: null, hand: [0, 1, 2], losses: 0, tieEx: 0, tieCount: 0 } },
    ...overrides };
}

function pvpMatch(id, overrides = {}) {
  return { id, mode: "human-vs-human", ownerId: "u1", status: "playing",
    roundCount: 0, pool: [0, 1, 2, 2], history: [],
    pendingMoves: { A: null, B: null }, version: 1, createdAt: T(), updatedAt: T(), name: id,
    hostUserId: "u1", guestUserId: "u2", matchNumber: 1, isPublic: false, inviteCode: "111111",
    startVotes: { A: true, B: true }, rematchVotes: { A: false, B: false },
    players: { A: { userId: "u1", username: "A", hand: [0, 1, 2], losses: 0, tieEx: 0, tieCount: 0 },
               B: { userId: "u2", username: "B", hand: [0, 1, 2], losses: 0, tieEx: 0, tieCount: 0 } },
    ...overrides };
}

function totalCards(m) { return sortCards(m.players.A.hand).length + sortCards(m.players.B.hand).length + sortCards(m.pool).length; }

// ═══ Card Invariants ═══
describe("Card Invariants", () => {
  test("Total cards always = 10", () => {
    const m = botMatch("i1");
    m.pendingMoves = { A: 0, B: 2 }; resolveRound(m);
    expect(totalCards(m)).toBe(10);
    m.pendingMoves = { A: 1, B: 1 }; resolveRound(m);
    expect(totalCards(m)).toBe(10);
    m.pendingMoves = { A: 2, B: 0 }; resolveRound(m);
    expect(totalCards(m)).toBe(10);
  });
  test("Bit packing never overflows", () => {
    const m = botMatch("i2");
    for (let i = 0; i < 30 && m.status === "playing"; i++) {
      m.pendingMoves = { A: 0, B: 1 }; resolveRound(m);
      const check = (b) => { const [r,p,s] = [b&7,(b>>>3)&7,(b>>>6)&7]; if(r<0||r>7||p<0||p>7||s<0||s>7) throw new Error(); };
      check(m.players.A.hand); check(m.players.B.hand); check(m.pool);
    }
  });
});

// ═══ Win/Lose/Tie ═══
describe("Round Resolution", () => {
  test("Win: winner keeps card + draws, loser loses to pool", () => {
    const m = botMatch("w1");
    m.pendingMoves = { A: 0, B: 2 };
    expect(resolveRound(m).round.result).toBe("win");
    expect(sortCards(m.players.A.hand).length).toBe(4);
    expect(sortCards(m.players.B.hand).length).toBe(2);
  });
  test("Lose perspective correct in PVP", () => {
    const m = pvpMatch("w2");
    m.pendingMoves = { A: 0, B: 1 };
    expect(resolveRound(m).round.result).toBe("lose");
  });
  test("Tie: both keep cards, both tieCount++", () => {
    const m = botMatch("w3");
    m.pendingMoves = { A: 1, B: 1 };
    resolveRound(m);
    expect(m.players.A.tieCount).toBe(1);
    expect(m.players.B.tieCount).toBe(1);
  });
  test("Win resets both tieCounts", () => {
    const m = botMatch("w4");
    m.players.A.tieCount = 3; m.players.B.tieCount = 3;
    m.pendingMoves = { A: 0, B: 2 }; resolveRound(m);
    expect(m.players.A.tieCount).toBe(0);
    expect(m.players.B.tieCount).toBe(0);
  });
});

// ═══ Opening Loss Exchange ═══
describe("Opening Loss Exchange", () => {
  test("Triggers on 2nd loss within first 3 rounds", () => {
    const m = botMatch("o1", { roundCount: 1 });
    m.players.A.losses = 1;
    m.pendingMoves = { A: 0, B: 1 };
    expect(resolveRound(m).round.specialActions.some(a => a.type === "opening-loss-exchange")).toBe(true);
    expect(m.players.A.losses).toBe(0);
  });
  test("Does NOT trigger on 1st loss", () => {
    const m = botMatch("o2", { roundCount: 1 });
    m.pendingMoves = { A: 0, B: 1 };
    expect(resolveRound(m).round.specialActions).toEqual([]);
  });
  test("Does NOT trigger after round 3", () => {
    const m = botMatch("o3", { roundCount: 3 });
    m.players.A.losses = 2;
    m.pendingMoves = { A: 0, B: 1 };
    expect(resolveRound(m).round.specialActions).toEqual([]);
  });
});

// ═══ Tie Exchange — Independent counters ═══
describe("Tie Exchange", () => {
  test("tieEx NOT set when tieCount < handSize", () => {
    const m = botMatch("t1");
    m.players.A.tieCount = 0; m.players.B.tieCount = 0;
    m.players.A.hand = [0,1]; m.players.B.hand = [0,1];
    m.pendingMoves = { A: 1, B: 1 }; resolveRound(m);
    // Only 1 tie, handSize=2 → no tieEx
    expect(m.players.A.tieEx).toBe(0);
  });
  test("tieEx sets when tieCount == handSize", () => {
    const m = botMatch("t2");
    m.players.A.tieCount = 1; m.players.B.tieCount = 1;
    m.players.A.hand = [0,1]; m.players.B.hand = [0,1];
    m.pendingMoves = { A: 1, B: 1 }; resolveRound(m);
    // A's tieEx preserved, B auto-exchanged → B reset
    expect(m.players.A.tieEx).toBe(1);
    expect(m.players.B.tieEx).toBe(0);
    expect(m.players.B.tieCount).toBe(0);
  });
  test("tieEx NOT set when tieCount exceeds handSize (skipped exchange)", () => {
    const m = botMatch("t3");
    m.players.A.tieCount = 2; m.players.B.tieCount = 2;
    m.players.A.hand = [0,1]; m.players.B.hand = [0,1];
    m.pendingMoves = { A: 1, B: 1 }; resolveRound(m);
    expect(m.players.A.tieEx).toBe(0);
  });
  test("Bot exchange: A's tieEx preserved, B reset", () => {
    const m = botMatch("t4");
    m.players.A.tieCount = 1; m.players.B.tieCount = 1;
    m.players.A.hand = [0,1]; m.players.B.hand = [0,1];
    m.pendingMoves = { A: 1, B: 1 }; resolveRound(m);
    expect(m.players.A.tieEx).toBe(1);
    expect(m.players.B.tieEx).toBe(0);
    expect(m.players.B.tieCount).toBe(0);
  });
});

// ═══ PVP Independent Tie Counters ═══
describe("PVP Independent Counters", () => {
  test("A's exchange doesn't affect B's tie streak", () => {
    const m = pvpMatch("pv1");
    m.players.A.tieCount = 0; m.players.A.tieEx = 0;
    m.players.B.tieCount = 2; m.players.B.hand = [0,1];
    m.pendingMoves = { A: 1, B: 1 }; resolveRound(m);
    expect(m.players.A.tieCount).toBe(1);
    expect(m.players.B.tieCount).toBe(3);
    expect(m.players.B.tieEx).toBe(0); // exceeded handSize
  });
  test("A skips exchange → A reset, B keeps count", () => {
    const m = pvpMatch("pv2");
    m.players.A.tieEx = 1; m.players.A.tieCount = 2;
    m.players.B.tieCount = 1; m.players.B.hand = [0,1];
    m.pendingMoves = { A: 0, B: 0 }; resolveRound(m);
    expect(m.players.A.tieCount).toBe(1);
    expect(m.players.B.tieCount).toBe(2);
    expect(m.players.B.tieEx).toBe(1);
  });
  test("Both exchange independently, counters don't cross-contaminate", () => {
    const m = pvpMatch("pv3");
    // A exchanged → tieCount=0, tieEx=0
    // B hasn't → tieCount=2
    m.players.A.tieCount = 0; m.players.A.tieEx = 0;
    m.players.B.tieCount = 2; m.players.B.hand = [0,1];
    m.pendingMoves = { A: 0, B: 0 }; resolveRound(m);
    // Tie → A:1, B:3
    expect(m.players.A.tieCount).toBe(1);
    expect(m.players.B.tieCount).toBe(3);
    expect(m.players.A.tieEx).toBe(0);
  });
  test("Pending moves cleared after round", () => {
    const m = pvpMatch("pv4");
    m.pendingMoves = { A: 0, B: 2 }; resolveRound(m);
    expect(m.pendingMoves.A).toBe(null);
    expect(m.pendingMoves.B).toBe(null);
  });
  test("Snapshot recorded per round", () => {
    const m = pvpMatch("pv5");
    m.pendingMoves = { A: 0, B: 1 }; resolveRound(m);
    const last = m.history[m.history.length - 1];
    expect(last.snap).toBeDefined();
    expect(typeof last.snap).toBe("number");
  });
  test("3 ties → both get tieEx at handSize=3", () => {
    const m = pvpMatch("pv6");
    for (let i = 0; i < 3; i++) { m.pendingMoves = { A: i%3, B: i%3 }; resolveRound(m); }
    expect(m.players.A.tieEx).toBe(1);
    expect(m.players.B.tieEx).toBe(1);
  });
});

// ═══ Game End ═══
describe("Game End", () => {
  test("A wins by eliminating B", () => {
    const m = botMatch("e1"); m.players.B.hand = [0];
    m.pendingMoves = { A: 1, B: 0 }; resolveRound(m);
    expect(m.status).toBe("finished"); expect(m.winner).toBe("A");
  });
  test("PVP winner correct", () => {
    const m = pvpMatch("e2"); m.players.B.hand = [0];
    m.pendingMoves = { A: 1, B: 0 }; resolveRound(m);
    expect(m.status).toBe("finished"); expect(m.winner).toBe("A");
  });
});

// ═══ Full Game Simulation ═══
describe("Full Game", () => {
  test("Bot game completes", () => {
    const m = botMatch("fg1");
    let r = 0;
    while (m.status === "playing" && r < 50) {
      m.pendingMoves = { A: r % 3, B: ((r % 3) + 1) % 3 }; resolveRound(m); r++;
    }
    expect(m.status).toBe("finished");
  });
  test("PVP game completes", () => {
    const m = pvpMatch("fg2");
    let r = 0;
    while (m.status === "playing" && r < 30) {
      m.pendingMoves = { A: r%3, B: (r+1)%3 }; resolveRound(m); r++;
    }
    expect(m.status).toBe("finished");
  });
  test("History contains valid entries through full game", () => {
    const m = pvpMatch("fg3");
    let r = 0;
    while (m.status === "playing" && r < 30) {
      m.pendingMoves = { A: r%3, B: (r+1)%3 }; resolveRound(m); r++;
    }
    for (const h of m.history.filter(x => x.type === "round")) {
      expect(["win","lose","tie"]).toContain(h.result);
      expect([0,1,2]).toContain(h.cards.A);
    }
  });
});

// ═══ Tie Exchange Card Selection (regression: PR #1) ═══
describe("Exchange Selection (doExchange)", () => {
  test("exchanges the requested card instead of always first()", () => {
    const s = createState();
    s.players.A.tieEx = 1; s.players.A.tieCount = 3;
    const r = doExchange(s, 1); // select Paper
    expect(r.putIntoPool).toBe(1);
    expect(cnt(s.players.A.hand)).toBe(3);
    expect(s.players.A.tieEx).toBe(0);
  });

  test("resets the player's tieCount (not a no-op on the root state)", () => {
    const s = createState();
    s.players.A.tieEx = 1; s.players.A.tieCount = 3;
    doExchange(s, 0);
    expect(s.players.A.tieCount).toBe(0);
    expect("tieCount" in s).toBe(false); // root-level reset was the bug
  });

  test("without a card param keeps legacy first() behavior", () => {
    const s = createState();
    s.players.A.tieEx = 1; s.players.A.tieCount = 3;
    const r = doExchange(s);
    expect(r.putIntoPool).toBe(0); // Rock
  });

  test("falls back to first() when requested card is not in hand", () => {
    const s = createState();
    s.players.A.hand = (1 << 3) | (1 << 6); // Paper + Scissors, no Rock
    s.players.A.tieEx = 1;
    const r = doExchange(s, 0);
    expect(r.putIntoPool).toBe(1); // smallest present
  });
});

describe("Server exchangeCard selection", () => {
  const mkBotMatch = (id, hand) => ({
    id, mode: "human-vs-bot", ownerId: "u1", status: "playing", botStrategy: "random",
    roundCount: 0, pool: [0, 1, 2, 2], history: [], pendingMoves: null,
    version: 1, createdAt: T(), updatedAt: T(), name: id,
    players: { A: { userId: "u1", hand, losses: 0, tieEx: 1, tieCount: 3 },
               B: { userId: null, hand: [0, 1, 2], losses: 0, tieEx: 0, tieCount: 0 } },
  });

  test("legacy call (no payload) swaps smallest card", async () => {
    currentMatch = mkBotMatch("x1", [0, 1, 2]);
    const res = await exchangeCard("x1", "u1");
    expect(res.exchange.putIntoPool).toBe(0);
  });

  test("payload.card is respected", async () => {
    currentMatch = mkBotMatch("x2", [0, 1, 2]);
    const res = await exchangeCard("x2", "u1", { card: 1 });
    expect(res.exchange.putIntoPool).toBe(1);
  });

  test("invalid card type is rejected", async () => {
    currentMatch = mkBotMatch("x3", [0, 1, 2]);
    await expect(exchangeCard("x3", "u1", { card: 7 })).rejects.toThrow("Card 0/1/2.");
  });

  test("falls back to first() when requested card is not in hand", async () => {
    currentMatch = mkBotMatch("x4", [1, 2]);
    const res = await exchangeCard("x4", "u1", { card: 0 });
    expect(res.exchange.putIntoPool).toBe(1);
  });
});
