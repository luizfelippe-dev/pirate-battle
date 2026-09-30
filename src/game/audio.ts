import { assetUrl } from "../paths";
export class AudioBus {
  enabled = false;
  private sounds = new Map<string, HTMLAudioElement>();
  play(name: string, volume = 0.25) {
    if (!this.enabled) return;
    let sound = this.sounds.get(name);
    if (!sound) {
      sound = new Audio(assetUrl(`sounds/${name}.wav`));
      this.sounds.set(name, sound);
    }
    sound.volume = volume;
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }
  dispose() {
    for (const s of this.sounds.values()) {
      s.pause();
      s.src = "";
    }
    this.sounds.clear();
  }
}
