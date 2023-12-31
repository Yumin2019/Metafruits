import GameScene from "./GameScene.js";

export default class MainScene extends GameScene {
  constructor() {
    super({
      sceneName: "MainScene",
      mapName: "main_map",
      musicPath: "../assets/background1.mp3",
    });
  }

  create() {
    super.create();
    super.createPortal({
      portalName: "portal1",
      destScene: "HouseScene",
      x: 398,
      y: 195,
      width: 32,
      height: 32,
      data: { spawnPosX: 225, spawnPosY: 970 },
    });

    super.createPortal({
      portalName: "portal2",
      destScene: "HouseScene",
      x: 593,
      y: 195,
      width: 32,
      height: 32,
      data: { spawnPosX: 800, spawnPosY: 970 },
    });
  }
}
