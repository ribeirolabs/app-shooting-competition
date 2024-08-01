import { produce, WritableDraft } from "immer";
import { atomWithReducer, selectAtom } from "jotai/utils";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { invariant } from "../utils/invariant";

function getId() {
  return window.crypto.randomUUID();
}

export type Player = {
  id: string;
  name: string;
  percentage: number;
  controlled: boolean;
};

export type Round = {
  id: string;
  name: string;
  order: string[];
  attempts: Record<string, (boolean | null)[]>;
  activePlayer: number;
  winner: string | null;
};

export type Game = {
  id: string;
  players: Player[];
  rounds: Round[];
  winner: null | Player;
  bestOf: number;
  attempts: number;
  activeRound: number;
};

export const GAME: Game = {
  id: getId(),
  winner: null,
  players: [],
  rounds: [],
  bestOf: 3,
  attempts: 5,
  activeRound: 0,
};

type Action =
  | {
      type: "simulate" | "make" | "miss";
    }
  | {
      type: "start";
      players: Player[];
      attempts: number;
      bestOf: number;
    };

function randomMake(percentage: number): boolean {
  const random = Math.round(Math.random() * 100);
  return random <= percentage;
}

export function gameReducer(state: Game, action: Action): Game {
  if (action.type === "simulate") {
    return produce(state, (game) => {
      const round = getActiveRound(game);
      const player = getActivePlayer(game);

      if (player.controlled) {
        return;
      }

      const makes = round.attempts[player.id];

      if (!makes) {
        throw new Error(`Player ${player.id} not found in round ${round.id}.`);
      }

      for (let i = 0; i < makes.length; i++) {
        if (makes[i] != null) {
          continue;
        }

        makes[i] = randomMake(player.percentage);
      }

      endRound(game);
    });
  }

  if (action.type === "make" || action.type === "miss") {
    return produce(state, (game) => {
      const round = getActiveRound(game);
      const player = getActivePlayer(game);

      if (!player.controlled) {
        return;
      }

      const makes = round.attempts[player.id];

      if (!makes) {
        throw new Error(`Player ${player.id} not found in round ${round.id}.`);
      }

      const nextMake = makes.findIndex((make) => make == null);

      if (nextMake < 0) {
        throw new Error("Invalid action, no more makes left");
      }

      makes[nextMake] = action.type === "make";

      if (nextMake === makes.length - 1) {
        endRound(game);
      }
    });
  }

  if (action.type === "start") {
    const next = produce(state, (game) => {
      game.players = action.players;
      game.attempts = action.attempts;
      game.bestOf = action.bestOf;
      createNextRound(game);
    });

    console.log(next);

    return next;
  }

  return state;
}

function checkWinners(game: WritableDraft<Game>): string[] {
  const round = getActiveRound(game);
  let max = 0;
  let winner: string[] = [];

  for (const playerId in round.attempts) {
    const attempts = round.attempts[playerId];
    let total = 0;

    for (const attempt of attempts) {
      if (attempt == null) {
        return [];
      } else if (attempt) {
        total++;
      }
    }

    if (total === max) {
      winner.push(playerId);
    } else if (total > max) {
      max = total;
      winner = [playerId];
    }
  }

  return winner;
}

function createNextRound(game: WritableDraft<Game>): void {
  const order =
    game.rounds.length > 0
      ? [...game.rounds[game.rounds.length - 1].order].reverse()
      : game.players.map((player) => player.id);

  game.activeRound = game.rounds.length;

  game.rounds.push({
    id: getId(),
    winner: null,
    name: `Round #${game.rounds.length + 1}`,
    order,
    activePlayer: 0,
    attempts: game.players.reduce(
      (all, player) => {
        all[player.id] = new Array(game.attempts).fill(null);
        return all;
      },
      {} as Round["attempts"],
    ),
  });
}

function overtime(game: WritableDraft<Game>): void {
  const round = getActiveRound(game);

  for (const id in round.attempts) {
    round.attempts[id].push(null);
  }
}

function hasAttemptsLeft(round: Round): boolean {
  for (const attempts of Object.values(round.attempts)) {
    for (const attempt of attempts) {
      if (attempt == null) {
        return true;
      }
    }
  }

  return false;
}

function checkGameOver(game: WritableDraft<Game>): boolean {
  const winsByPlayer: Record<string, number> = {};
  const winsToFinish = Math.ceil(game.bestOf / 2);

  for (const round of game.rounds) {
    if (round.winner) {
      if (round.winner in winsByPlayer) {
        winsByPlayer[round.winner]++;
      } else {
        winsByPlayer[round.winner] = 1;
      }

      if (winsByPlayer[round.winner] === winsToFinish) {
        const player = game.players.find(
          (player) => player.id === round.winner,
        );
        invariant(player, `Player not found with id ${round.winner}`);
        game.winner = player;
        return true;
      }
    }
  }

  return false;
}

function endRound(game: WritableDraft<Game>): void {
  const winners = checkWinners(game);

  const round = getActiveRound(game);
  const nextRound = game.activeRound + 1;

  if (winners.length > 1) {
    // TIE
    overtime(game);
    return;
  } else if (winners.length === 1) {
    // WINNER
    round.winner = winners[0];

    if (checkGameOver(game)) {
      return;
    }

    createNextRound(game);
  }

  if (hasAttemptsLeft(round)) {
    round.activePlayer = (round.activePlayer + 1) % round.order.length;
    return;
  }

  const isLastPlayer = round.activePlayer === round.order.length - 1;
  const hasMoreRounds = nextRound < game.rounds.length;

  if (isLastPlayer && hasMoreRounds) {
    round.activePlayer = 0;
    game.activeRound = nextRound;
  }
}

export const gameAtom = atomWithReducer(structuredClone(GAME), gameReducer);

function getRoundById<T extends Game>(
  game: T,
  id: string,
): T["rounds"][number] {
  const round = game.rounds.find((round) => round.id === id);
  invariant(round, `Round with id ${id} not found.`);
  return round;
}

function getActiveRound<T extends Game>(game: T): T["rounds"][number] {
  const round = game.rounds[game.activeRound];
  invariant(round, `Round ${game.activeRound} not found.`);
  return round;
}

function getActivePlayer<T extends Game>(game: T): T["players"][number] {
  const round = getActiveRound(game);

  const playerId = round.order[round.activePlayer];
  const player = game.players.find((player) => player.id === playerId);
  invariant(player, `Player ${round.activePlayer} not found.`);

  return player;
}

export function usePlayers() {
  return useAtomValue(
    useMemo(() => selectAtom(gameAtom, (game) => game.players), []),
  );
}

export function useRound(id: string) {
  return useAtomValue(
    useMemo(
      () =>
        selectAtom(gameAtom, (game) => {
          return getRoundById(game, id);
        }),
      [id],
    ),
  );
}

export function useActiveRound() {
  return useAtomValue(useMemo(() => selectAtom(gameAtom, getActiveRound), []));
}

export function useActivePlayer() {
  return useAtomValue(useMemo(() => selectAtom(gameAtom, getActivePlayer), []));
}

function getGameAttempts(game: Game): number {
  return game.attempts;
}

export function useGameAttempts() {
  return useAtomValue(useMemo(() => selectAtom(gameAtom, getGameAttempts), []));
}
