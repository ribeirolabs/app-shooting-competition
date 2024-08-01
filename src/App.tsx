import { twMerge } from "tailwind-merge";
import { atom, PrimitiveAtom, useAtom, useAtomValue } from "jotai";
import {
  ChangeEvent,
  FormEvent,
  Fragment,
  ReactNode,
  useEffect,
  useState,
} from "react";
import {
  gameAtom,
  usePlayers,
  useRound,
  useGameAttempts,
  useActiveRound,
  useActivePlayer,
  Player,
} from "./state/game";
import { createStore } from "jotai/vanilla";
import { Provider, useSetAtom } from "jotai/react";

const store = createStore();

function Root({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}

function App() {
  const game = useAtomValue(gameAtom);

  return (
    <div className="flex flex-col h-full p-2 gap-4">
      {game.players.length === 0 ? (
        <PlayersForm />
      ) : (
        <div className="p-2 flex-1 space-y-4">
          {game.rounds.map((round) => {
            return <RoundDetails key={round.id} id={round.id} />;
          })}
        </div>
      )}
    </div>
  );
}

function emptyPlayer(): Player {
  return {
    id: window.crypto.randomUUID(),
    name: "",
    controlled: false,
    percentage: 0,
  };
}

const playersAtom = atom([atom(emptyPlayer())]);

function PlayersForm() {
  const send = useSetAtom(gameAtom);
  const [playersAtoms, setPlayersAtoms] = useAtom(playersAtom);

  function addPlayer() {
    setPlayersAtoms((players) => players.concat(atom(emptyPlayer())));
  }

  function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const players = playersAtoms.map((player) => store.get(player));
    send({ type: "start", players });
  }

  return (
    <form className="p-2 space-y-4" onSubmit={confirm}>
      {playersAtoms.map((playerAtom) => (
        <PlayerForm key={playerAtom.toString()} playerAtom={playerAtom} />
      ))}

      <div className="h-[1px] border-b" />

      <div className="flex gap-2">
        <button
          type="button"
          className="w-full h-12 flex items-center justify-center text-3xl bg-white/0 rounded-xl border text-zinc-400"
          onClick={addPlayer}
        >
          +
        </button>

        <button
          type="submit"
          className="w-full h-12 tracking-wide font-bold bg-blue-500/10 rounded-xl border border-transparent text-blue-100 disabled:opacity-30 disabled:pointer-events-none"
          disabled={playersAtoms.length < 2}
        >
          Confirm
        </button>
      </div>
    </form>
  );
}

function PlayerForm({ playerAtom }: { playerAtom: PrimitiveAtom<Player> }) {
  const [player, setPlayer] = useAtom(playerAtom);

  function updateName(e: ChangeEvent<HTMLInputElement>) {
    setPlayer((player) => {
      return {
        ...player,
        name: e.target.value,
      };
    });
  }

  function updatePercentage(e: ChangeEvent<HTMLInputElement>) {
    setPlayer((player) => {
      return {
        ...player,
        percentage: e.target.valueAsNumber,
      };
    });
  }

  function updateControlled(e: ChangeEvent<HTMLInputElement>) {
    setPlayer((player) => {
      return {
        ...player,
        controlled: e.target.checked,
      };
    });
  }

  return (
    <div className="flex gap-4 rounded-xl">
      <label className="flex-[2]">
        <div className="font-bold">Name</div>
        <input
          type="text"
          className="p-2 rounded"
          value={player.name}
          onChange={updateName}
        />
      </label>
      <label className="flex-1">
        <div className="font-bold">Percentage</div>
        <input
          type="number"
          className="p-2 rounded"
          value={player.percentage}
          onChange={updatePercentage}
        />
      </label>
      <label className="flex-1 text-center">
        <div className="font-bold">Controlado</div>
        <input
          type="checkbox"
          className="p-2 rounded w-9 h-9"
          checked={player.controlled}
          onChange={updateControlled}
        />
      </label>
    </div>
  );
}

function RoundDetails({ id }: { id: string }) {
  const [opened, setOpened] = useState(true);
  const players = usePlayers();
  const round = useRound(id);
  const winner = players.find((player) => player.id === round.winner);
  const hasWinner = round.winner != null;
  const totalAttempts = useGameAttempts();

  useEffect(() => {
    if (hasWinner) {
      setOpened(false);
    }
  }, [hasWinner]);

  return (
    <div key={round.id} className="bg-zinc-950/50 p-3 rounded-xl space-y-2">
      <button
        className="flex justify-between items-center p-2 rounded-lg w-full"
        disabled={!hasWinner}
        onClick={() => setOpened((opened) => !opened)}
      >
        <div className="font-bold text-xl text-center">{round.name}</div>

        {winner ? (
          <div className="font-bold text-xl text-center text-yellow-500">
            {winner.name} 👑
          </div>
        ) : null}
      </button>

      <div className={twMerge("space-y-4", opened === false && "hidden")}>
        {round.order.map((playerId, idx) => {
          const player = players.find((player) => player.id === playerId);

          if (!player) {
            throw new Error(`Invalid game, player ${playerId} not found.`);
          }

          const attempts = round.attempts[player.id];
          const [makes, misses] = attempts.reduce(
            (total, attempt) => {
              if (attempt === true) {
                total[0]++;
                total[1]++;
              } else if (attempt === false) {
                total[1]++;
              }

              return total;
            },
            [0, 0],
          );

          const isActive = round.activePlayer === idx;
          const hasWinner = round.winner != null;
          const isWinner = round.winner === playerId;

          return (
            <div
              key={player.id}
              className={twMerge(
                "p-4 space-y-2 rounded-lg border-2 bg-zinc-800/50 border-transparent",
                isWinner
                  ? "border-yellow-600 bg-yellow-700/5"
                  : !hasWinner && isActive
                    ? "border-zinc-300"
                    : "",
              )}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-xl">{player.name}</span>
                  <span className="text-zinc-500">({player.percentage}%)</span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span>
                    {makes}/{misses}
                  </span>
                  <span className="text-zinc-500">
                    ({Math.round((makes / misses) * 100) || 0}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {attempts.map((attempt, idx) => (
                  <Fragment key={idx}>
                    {idx === totalAttempts ? (
                      <div className="mx-1 w-[1px] h-full bg-zinc-700 shrink-0 grow-0">
                        &nbsp;
                      </div>
                    ) : null}
                    <div
                      className={twMerge(
                        "w-8 aspect-square rounded-full border",
                        attempt == null
                          ? "bg-transparent"
                          : attempt
                            ? "bg-green-900 border-transparent"
                            : "bg-zinc-700 border-transparent",
                      )}
                    />
                  </Fragment>
                ))}
              </div>

              {hasWinner ? null : <Toolbar playerId={playerId} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toolbar({ playerId }: { playerId: string }) {
  const send = useSetAtom(gameAtom);
  const round = useActiveRound();
  const player = useActivePlayer();

  if (playerId !== player.id) {
    return null;
  }

  const makes = round.attempts[player.id];

  return player.controlled ? (
    <div className="flex gap-4 w-full justify-center">
      <button
        className="flex-1 bg-red-400/5 text-red-300 text-lg px-4 py-3 rounded-full font-bold tracking-wide disabled:opacity-30 disabled:pointer-events-none"
        disabled={makes.filter((make) => make != null).length === makes.length}
        onClick={() => send({ type: "miss" })}
      >
        Miss
      </button>
      <button
        className="flex-1 bg-green-500/20 text-green-100 text-lg px-4 py-3 rounded-full font-bold tracking-wide disabled:opacity-30 disabled:pointer-events-none"
        disabled={makes.filter((make) => make != null).length === makes.length}
        onClick={() => send({ type: "make" })}
      >
        Make
      </button>
    </div>
  ) : (
    <button
      className="bg-blue-600/10 text-blue-100 text-lg px-4 py-3 rounded-full font-bold tracking-wide disabled:opacity-30 disabled:pointer-events-none w-full"
      disabled={makes.filter((make) => make != null).length === makes.length}
      onClick={() => send({ type: "simulate" })}
    >
      Simulate
    </button>
  );
}

export default Root;
