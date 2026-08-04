import Phaser from "phaser";
import { GameScene } from "./game/GameScene";
import "./style.css";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#101713",
  pixelArt: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
  },
  scene: [GameScene],
});

