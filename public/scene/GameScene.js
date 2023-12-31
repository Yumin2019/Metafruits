import { divideMessage, isMobile } from "../gameLogic/GameFunc.js";
import { exitRoom, joinRoom, socket } from "../gameLogic/SocketLogic.js";
import Player from "../object/Player.js";
import Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
  constructor(data) {
    // sceneName: Phaser Scene 변수, mapName: map json 이름
    const { sceneName, mapName, musicPath } = data;
    super({
      key: sceneName,
    });

    this.sceneName = sceneName;
    this.mapName = mapName;
    this.initialized = false;
    this.otherPlayers = {};
    this.musicPath = musicPath;
  }

  // function eventQueue after initialization of GameScene
  static eventQueue = [];

  preload() {
    Player.preload(this);

    // 공통 리소스를 로드한다.
    this.load.image("beach_tileset", "../assets/beach_tileset_extruded.png");
    this.load.image("beach_tileset2", "../assets/beach_tileset2_extruded.png");
    this.load.image("house1", "../assets/house1.png");
    this.load.image("house2", "../assets/house2.png");
    this.load.tilemapTiledJSON(this.mapName, `../assets/${this.mapName}.json`);

    this.load.audio("door", ["assets/door.mp3"]);
    this.load.audio("button", ["assets/button.mp3"]);
    this.load.audio(this.musicPath, [this.musicPath]);
  }

  create() {
    this.playerCollisionGroup = this.matter.world.nextGroup(true);
    GameScene.eventQueue.forEach((func) => {
      func();
    });
    GameScene.eventQueue = [];

    // 배경음악 시작 및 음악 로드
    this.music = this.sound.add(this.musicPath, { loop: true, volume: 0.4 });
    this.door = this.sound.add("door", { loop: false, volume: 0.5 });
    this.button = this.sound.add("button", { loop: false, volume: 0.5 });

    if (this.game.global.bgm) this.music.play();
  }

  static playButtonEffect(scene) {
    if (scene.game.global.otherSound) scene.button.play();
  }

  static setName(scene, name) {
    scene.nameText.setText(name);
  }

  static setMessage(scene, playerId, message) {
    // refactor: 현재 플레이어 정보와 타 플레이어의 정보를 분리하여 처리하고 있는데
    // 굳이 그럴 필요가 없을 것으로 보인다. 공통으로 처리할 수 있는 부분으로 정리하는 게 좋을 듯.
    const isMyInfo = playerId === socket.id;
    const playerJson = isMyInfo ? undefined : scene.otherPlayers[playerId];

    // 다른 Scene에 존재하는 플레이어의 경우 제외한다.
    if (!isMyInfo && !playerJson) return;

    const text = divideMessage(message);
    const messageRect = isMyInfo ? scene.messageRect : playerJson.messageRect;
    const messageText = isMyInfo ? scene.messageText : playerJson.messageText;
    const container = isMyInfo ? scene.container : playerJson.container;
    const messageSize = isMyInfo ? scene.messageSize : playerJson.messageSize;

    messageRect.clear();
    messageText.setText(text);
    container.setActive(true).setVisible(true);

    // fix: 명시적으로 지정하지 않으면 오류 발생
    if (isMyInfo) {
      if (scene.tweenAnim) scene.tweenAnim.destroy();
    } else {
      if (playerJson.tweenAnim) playerJson.tweenAnim.destroy();
    }

    messageSize.messageWidth = messageText.width + scene.messagePadding * 2;
    messageSize.messageHeight = messageText.height + scene.messagePadding * 2;
    messageRect
      .lineStyle(2, 0x000000, 1)
      .fillStyle(0xffffff, 1.0)
      .fillRoundedRect(
        0,
        0,
        messageSize.messageWidth,
        messageSize.messageHeight,
        5
      )
      .strokeRoundedRect(
        0,
        0,
        messageSize.messageWidth,
        messageSize.messageHeight,
        5
      );

    // Tween 애니메이션은 재활용이 안 된다.
    let tweenAnim = scene.tweens.add({
      targets: [container],
      ease: "Sine.easeInOut",
      duration: 4000,
      alpha: {
        getStart: () => 1.0,
        getEnd: () => 0.0,
      },
      onComplete: () => {
        container.setActive(false).setVisible(false);
      },
    });

    // fix: 명시적으로 지정하지 않으면 오류 발생
    if (isMyInfo) {
      scene.tweenAnim = tweenAnim;
    } else {
      playerJson.tweenAnim = tweenAnim;
    }
  }

  createMessageContainer() {
    // 메시지 컨테이너를 생성한다. 세부 설정은 하지 않음
    this.messageSize = {
      messageWidth: 0,
      messageHeight: 0,
    };
    this.messagePadding = 2;
    this.tweenAnim = undefined;

    // positions are relative to the container
    this.messageRect = this.add.graphics();
    this.messageText = this.add
      .text(this.messagePadding, this.messagePadding, "")
      .setFont("10px")
      .setColor("#000000");

    this.container = this.add
      .container(0, 0, [this.messageRect, this.messageText])
      .setDepth(100)
      .setVisible(false)
      .setActive(false);
  }

  updateTextInfo() {
    // update left top info text
    if (!this.game.global.esc) {
      this.posText.setText(
        `x: ${Math.round(this.player.x)} y: ${Math.round(
          this.player.y
        )}\nfps: ${Math.round(this.game.loop.actualFps)}\n\nbgm: 1(${
          this.game.global.bgm ? "on" : "off"
        })\nsound: 2(${
          this.game.global.otherSound ? "on" : "off"
        })\nstatus: esc\nmove: wasd`
      );
    }

    // update name text
    this.nameText.x = this.player.x - this.nameText.width * 0.5;
    this.nameText.y =
      this.player.y - this.player.height * 0.5 - this.nameText.height;
  }

  updateMessageContainer() {
    // player's offset is 0.5
    // x는 중간에 오도록 처리하고 y는 플레이어 상단 기준에서 메시지 크기 만큼 올린다. (12 is yOffset)
    if (this.container.visible) {
      this.container.x = this.player.x - this.messageSize.messageWidth * 0.5;
      this.container.y =
        this.player.y -
        this.player.height * 0.5 -
        this.messageSize.messageHeight -
        12;
    }

    let otherPlayers = Object.values(this.otherPlayers);
    otherPlayers.forEach((playerJson) => {
      if (playerJson.container.visible) {
        playerJson.container.x =
          playerJson.player.x - playerJson.messageSize.messageWidth * 0.5;
        playerJson.container.y =
          playerJson.player.y -
          playerJson.player.height * 0.5 -
          playerJson.messageSize.messageHeight -
          12;
      }
    });
  }

  update() {
    if (this.initialized) {
      this.player.update();
      this.updateTextInfo();
      this.updateMessageContainer();
    }
  }

  createText() {
    this.posText = this.add
      .text(0, 0, "", {
        font: "16px",
        fill: "#000000",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.nameText = this.add
      .text(0, 0, this.game.global.name)
      .setFont("10px")
      .setColor("#000000")
      .setDepth(100);
  }

  createCamera() {
    // add main camera to player
    this.cameras.main
      .setBounds(0, 0, this.mapWidth, this.mapHeight)
      .setName("MainCamera");
    this.matter.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.startFollow(this.player);

    // 미니맵 추가
    let { width, height } = this.game.canvas;

    // offset 0.5, leftTop을 기준으로 배치한다.
    this.minimapBackground = this.add
      .rectangle(
        parseInt(this.mapWidth * 0.05 + width - this.mapWidth * 0.1) - 4,
        parseInt(this.mapHeight * 0.05 + height - this.mapHeight * 0.1) - 4,
        parseInt(this.mapWidth * 0.1) + 8,
        parseInt(this.mapHeight * 0.1) + 8,
        0x9dde85
      )
      .setDepth(100)
      .setScrollFactor(0);

    this.minimap = this.cameras
      .add(
        parseInt(width - this.mapWidth * 0.1) - 4,
        parseInt(height - this.mapHeight * 0.1) - 4,
        parseInt(this.mapWidth * 0.1),
        parseInt(this.mapHeight * 0.1)
      )
      .setZoom(0.1)
      .setName("MiniMap")
      .setScroll(this.mapWidth * 0.45, this.mapHeight * 0.45)
      .ignore(this.minimapBackground); // ignore background object

    if (this.joystick) {
      this.minimap.ignore([this.joystick.base, this.joystick.thumb]);
    }

    // 미니앱이 off 상태인 경우, 생성까지만 진행한다.
    if (!this.game.global.minimap) {
      this.minimapBackground.setActive(false).setVisible(false);
      this.cameras.remove(this.minimap, false);
    }
  }

  static toggleMinimap(scene) {
    let flag = !scene.minimapBackground.active;
    scene.game.global.minimap = flag;
    scene.minimapBackground.setActive(flag).setVisible(flag);

    // remove: 카메라를 재사용하는 경우 2번째 인자를 false로 주고,
    // 나중에 CameraManager에 해당 카메라를 추가하여 사용한다.
    if (flag) scene.cameras.addExisting(scene.minimap);
    else scene.cameras.remove(scene.minimap, false);
  }

  static toggleBgm(scene) {
    scene.game.global.bgm = !scene.game.global.bgm;
    scene.game.global.bgm ? scene.music.play() : scene.music.stop();
  }

  static toggleOtherSound(scene) {
    scene.game.global.otherSound = !scene.game.global.otherSound;
  }

  static toggleESC(scene) {
    scene.game.global.esc = !scene.game.global.esc;
    if (scene.game.global.esc) scene.posText.setText("");
  }

  createPortal(portalData) {
    const { portalName, destScene, x, y, width, height } = portalData;

    let portal = this.matter.add.rectangle(x, y, width, height);
    portal.onCollideCallback = (pair) => {
      if (
        pair.bodyA.label === "playerSensor" ||
        pair.bodyB.label === "playerSensor"
      ) {
        this.music.stop();

        if (this.game.global.otherSound) this.door.play();

        // 충돌시 장면 전환(Fade 효과)
        this.initialized = false;
        this.cameras.main.fadeOut(250, 200, 200, 200);
        this.cameras.main.once(
          Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          (cam, effect) => {
            destScene === "HouseScene" ? joinRoom() : exitRoom();
            this.scene.start(destScene);

            // fix: 장면 전환후 회색화면이 표츌되는 이슈 수정
            setTimeout(() => {
              socket.emit("portal", portalData);
            }, 25);
          }
        );
      }
    };

    this.matter.add.gameObject(portal, {
      isStatic: true,
      label: portalName,
    });
  }

  createTileMap() {
    // create tilemap with tilemap.json
    const map = this.make.tilemap({
      key: this.mapName,
      tileWidth: 32,
      tileHeight: 32,
    });

    this.mapWidth = map["widthInPixels"];
    this.mapHeight = map["heightInPixels"];

    // add tileset images to map
    map.addTilesetImage("beach_tileset", "beach_tileset", 34, 34, 0, 0);
    map.addTilesetImage("beach_tileset2", "beach_tileset2", 34, 34, 0, 0);
    map.addTilesetImage("house1", "house1", 32, 32, 0, 0);
    map.addTilesetImage("house2", "house2", 32, 32, 0, 0);

    // create map's layer with layer name(Tiled) and used tileset
    const backgroundLayer = map.createLayer(
      "Background",
      ["beach_tileset", "beach_tileset2"],
      0,
      0
    );

    const itemsLayer = map.createLayer(
      "Items",
      ["beach_tileset", "house1", "house2"],
      0,
      0
    );

    const bridgeLayer = map.createLayer("Bridge", ["beach_tileset"], 0, 0);

    itemsLayer.setDepth(10);
    backgroundLayer.setCollisionByProperty({
      collides: true,
    });

    bridgeLayer.setCollisionByProperty({
      collides: true,
    });

    itemsLayer.setCollisionByProperty({
      collides: true,
    });

    this.matter.world.convertTilemapLayer(backgroundLayer);
    this.matter.world.convertTilemapLayer(bridgeLayer);
    this.matter.world.convertTilemapLayer(itemsLayer);
  }

  createPlayer() {
    if (isMobile) {
      // 조이스틱 for Mobile web
      let margin = 40;
      this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
        x: this.game.config.width - 50 - margin,
        y: 50 + margin,
        radius: 25,
        base: this.add.circle(0, 0, 50, 0x888888).setDepth(100),
        thumb: this.add.circle(0, 0, 25, 0xcccccc).setDepth(100),
        fixed: true,
        enable: true,
      });
    }

    this.player = new Player({
      isMyInfo: true,
      scene: this,
      x: 300,
      y: 400,
      texture: "cute_fruits",
      frame: `${this.game.global.character}_idle_1`,
      joystick: this.joystick,
    });

    this.player.setCollisionGroup(this.playerCollisionGroup);
    this.player.inputKeys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      minimap: Phaser.Input.Keyboard.KeyCodes.M,
      bgm: Phaser.Input.Keyboard.KeyCodes.ONE,
      otherSound: Phaser.Input.Keyboard.KeyCodes.TWO,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    });
  }

  // 서버 통신 로직
  // 서버로 부터 받은 데이터를 토대로 내 정보를 갱신한다.
  static setMyPlayer(scene, info) {
    const { x, y, playerId, name, character } = info;

    scene.createTileMap();
    scene.createPlayer();
    scene.createText();
    scene.createMessageContainer();
    scene.createCamera();

    scene.player.x = x;
    scene.player.y = y;

    scene.game.global.playerId = playerId;
    scene.game.global.name = name;
    scene.game.global.character = character;

    scene.nameText.setText(name);
    scene.initialized = true;

    scene.cameras.main.fadeIn(250, 200, 200, 200);
  }

  // 새로운 플레이어를 추가한다.
  static addPlayer(scene, info) {
    let otherPlayer = new Player({
      isMyInfo: false,
      scene: scene,
      x: info.x,
      y: info.y,
      texture: "cute_fruits",
      frame: `${info.character}_idle_1`,
    });

    // 새로운 플레이어의 이름, 메시지 Container
    let nameText = scene.add
      .text(0, 0, info.name, {
        font: "10px",
        fill: "#000000",
      })
      .setDepth(100);

    nameText.x = info.x - nameText.width * 0.5;
    nameText.y = info.y - otherPlayer.height * 0.5 - nameText.height;

    let messageRect = scene.add.graphics();
    let messageText = scene.add
      .text(scene.messagePadding, scene.messagePadding, "")
      .setFont("10px")
      .setColor("#000000");

    let container = scene.add
      .container(0, 0, [messageRect, messageText])
      .setDepth(100)
      .setVisible(false)
      .setActive(false);

    // disable collision using unique group id
    otherPlayer.setCollisionGroup(scene.playerCollisionGroup);
    scene.otherPlayers[info.playerId] = {
      player: otherPlayer,
      nameText: nameText,
      messageRect,
      messageText,
      container,
      messageSize: {
        messageWidth: 0,
        messageHeight: 0,
      },
    };
  }

  static removePlayer(scene, playerId) {
    let playerJson = scene.otherPlayers[playerId];
    playerJson.player.destroy();
    playerJson.nameText.destroy();
    playerJson.messageRect.destroy();
    playerJson.messageText.destroy();
    playerJson.container.destroy();

    delete scene.otherPlayers[playerId];
  }

  static updatePlayer(scene, info) {
    // fix: 로딩 전에 처리되는 경우 catch
    try {
      const { x, y, flipX, curAnim, playerId, name } = info;
      let player = scene.otherPlayers[playerId].player;
      let nameText = scene.otherPlayers[playerId].nameText;

      player.x = x;
      player.y = y;
      player.flipX = flipX;
      player.curAnim = curAnim;
      player.setFlipX(flipX);
      player.anims.play(curAnim, true);
      nameText.setText(name);

      // update name texta
      nameText.x = player.x - nameText.width * 0.5;
      nameText.y = player.y - player.height * 0.5 - nameText.height;
    } catch (error) {}
  }
}
