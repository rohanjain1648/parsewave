/**
 * The host's tally for "the crowd affects the run". Timers count game time and
 * only run while voting makes sense (spectators present, no level-up huddle).
 */
export type CrowdChoice = "supply" | "surge";

export const VOTE_GAP_SEC = 35;
export const VOTE_WINDOW_SEC = 10;
/** The first vote comes sooner, so a new spectator gets a say quickly. */
export const FIRST_VOTE_SEC = 15;

export type VoteEvent =
  | { kind: "open"; round: number; seconds: number }
  | { kind: "result"; round: number; choice: CrowdChoice | null; supply: number; surge: number };

export class CrowdVoteHost {
  private round = 0;
  private open = false;
  private timer = FIRST_VOTE_SEC;
  private readonly votes = new Map<string, CrowdChoice>();

  /** `ended`: the run is over, so an open vote closes now with no winner. */
  tick(dt: number, canRun: boolean, ended = false): VoteEvent | null {
    if (ended && this.open) {
      this.open = false;
      this.timer = FIRST_VOTE_SEC;
      const { supply, surge } = this.count();
      return { kind: "result", round: this.round, choice: null, supply, surge };
    }
    if (!canRun) return null;
    this.timer -= dt;
    if (this.timer > 0) return null;
    if (!this.open) {
      this.open = true;
      this.round++;
      this.votes.clear();
      this.timer = VOTE_WINDOW_SEC;
      return { kind: "open", round: this.round, seconds: VOTE_WINDOW_SEC };
    }
    this.open = false;
    this.timer = VOTE_GAP_SEC;
    const { supply, surge } = this.count();
    const choice: CrowdChoice | null = supply + surge === 0 ? null : surge > supply ? "surge" : "supply";
    return { kind: "result", round: this.round, choice, supply, surge };
  }

  private count(): { supply: number; surge: number } {
    let supply = 0;
    let surge = 0;
    for (const v of this.votes.values()) {
      if (v === "supply") supply++;
      else surge++;
    }
    return { supply, surge };
  }

  /** One vote per viewer per round; anything else is ignored. */
  cast(userId: string, round: number, choice: CrowdChoice): void {
    if (!this.open || round !== this.round) return;
    if (choice !== "supply" && choice !== "surge") return;
    if (!this.votes.has(userId)) this.votes.set(userId, choice);
  }
}
