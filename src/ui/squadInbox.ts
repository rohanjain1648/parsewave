import { connectChat } from "../chat/nexconnTransport";
import { squads } from "../chat/squadBook";

/**
 * The Squads inbox: Nexconn's ready-made Chat UI, full screen, listing every
 * squad this browser has played with. Squad channels outlive their match, so
 * players can keep talking and plan the next run. Opened from the title screen.
 */
export async function openSquadInbox(relayHttp: string, onClose: () => void): Promise<void> {
  const overlay = document.createElement("div");
  overlay.className = "squad-inbox";
  overlay.innerHTML = `
    <div class="squad-inbox-head">
      <strong>SQUADS</strong>
      <span>Everyone you've played co-op with. Chat now, play later.</span>
      <button type="button" class="squad-inbox-close">Close</button>
    </div>
    <div class="squad-inbox-body"><p class="squad-inbox-status">Connecting…</p></div>`;
  const body = overlay.querySelector(".squad-inbox-body") as HTMLElement;
  const close = (): void => {
    overlay.remove();
    window.removeEventListener("keydown", onKey, true);
    onClose();
  };
  const onKey = (e: KeyboardEvent): void => {
    // Typing in the inbox must never reach the game behind it.
    e.stopPropagation();
    if (e.key === "Escape") close();
  };
  window.addEventListener("keydown", onKey, true);
  overlay.addEventListener("pointerdown", (e) => e.stopPropagation());
  (overlay.querySelector(".squad-inbox-close") as HTMLButtonElement).addEventListener("click", close);
  document.body.append(overlay);

  try {
    const { sdk, ui } = await connectChat(relayHttp);
    if (!ui) throw new Error("Chat UI unavailable");
    body.replaceChildren(document.createElement("nc-chat-ui-app-provider"));
    const latest = squads()[0];
    if (latest) {
      // The provider element must render before it can open a conversation.
      await customElements.whenDefined("nc-chat-ui-app-provider");
      await new Promise((r) => setTimeout(r, 300));
      const res = await ui.openChannel(new sdk.GroupChannelIdentifier(latest.id));
      if (!res.isOk) console.warn("squads inbox: couldn't open the latest squad:", res.code);
    }
    else {
      const note = document.createElement("p");
      note.className = "squad-inbox-status";
      note.textContent = "Play a co-op run and your squad shows up here.";
      body.prepend(note);
    }
  } catch (e) {
    console.warn("squads inbox unavailable:", e);
    (body.querySelector(".squad-inbox-status") ?? body).textContent = "Chat is unavailable right now. Try again in a minute.";
  }
}
