import log from "electron-log";
import { AxiosResponse } from "axios";
import { GameMode } from "@/constants";

export type ValorantRawPresence = {
  actor: string;
  basic: string;
  details: string;
  game_name: string;
  game_tag: string;
  location: string;
  msg: string;
  name: string;
  patchline: string;
  pid: string;
  platform: string;
  private: string;
  privateJwt: string;
  product: string;
  puuid: string;
  region: string;
  resource: string;
  state: string;
  summary: string;
  time: number;
};

export class ValorantPresence {
  name: string;
  tag: string;
  pid: string;
  state: string;
  game_state: string; // INGAME, PREGAME, MENUS
  game_mode: string; //"spikerush", "competitive", "deathmatch", "unrated", "snowball" or empty str (custom game)
  score_ally: number;
  score_enemy: number;
  party_id: string;
  party_size: number;
  card_id: string;
  title_id: string;
  accountLevel: number;
  competitiveTier: number;
  leaderboardPosition: number;

  constructor(presence: ValorantRawPresence) {
    this.state = presence["state"];
    this.name = presence["game_name"];
    this.tag = presence["game_tag"];
    this.pid = presence["pid"];

    let private_presence = JSON.parse(
      Buffer.from(presence["private"], "base64").toString("ascii")
    );

    this.game_state = private_presence["sessionLoopState"];
    this.game_mode =
      private_presence["provisioningFlow"] == "ShootingRange"
        ? "In Range"
        : GameMode.get(private_presence["queueId"]) ??
          private_presence["queueId"];
    this.score_ally = private_presence["partyOwnerMatchScoreAllyTeam"];
    this.score_enemy = private_presence["partyOwnerMatchScoreEnemyTeam"];
    this.party_id = private_presence["partyId"];
    this.party_size = private_presence["partySize"];
    this.card_id = private_presence["playerCardId"];
    this.title_id = private_presence["playerTitleId"];
    this.accountLevel = private_presence["accountLevel"];
    this.competitiveTier = private_presence["competitiveTier"];
    this.leaderboardPosition = private_presence["leaderboardPosition"];
  }
}

export class ValorantPresenceSelf extends ValorantPresence {
  match_id?: string;

  constructor(
    presence: ValorantRawPresence,
    get_game_id: (endpoint: string) => Promise<AxiosResponse | undefined>
  ) {
    super(presence);
    switch (this.game_state) {
      case "PREGAME":
        get_game_id(`/pregame/v1/players/${presence["puuid"]}`).then((res) => {
          this.match_id = res?.data["MatchID"];
        });
        break;
      case "INGAME":
        get_game_id(`/core-game/v1/players/${presence["puuid"]}`).then(
          (res) => (this.match_id = res?.data["MatchID"])
        );
        break;
    }
  }
}

export function process_valorant_presence(
  presences: ValorantRawPresence[] | undefined,
  puuid: string,
  query_function: (endpoint: string) => Promise<AxiosResponse | undefined>
): Map<string, ValorantRawPresence> {
  let ret = new Map();
  if (!presences) return ret;
  for (let p of presences) {
    if (p["product"] != "valorant") continue;
    log.debug("Updating presence: " + p["puuid"]);
    if (p["puuid"] == puuid)
      ret.set(p["puuid"], new ValorantPresenceSelf(p, query_function));
    else ret.set(p["puuid"], new ValorantPresence(p));
  }
  return ret;
}
