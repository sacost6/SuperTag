// Phaser Framework CONFIG, AUTO uses Canvas/WEBGL for rendering, whichever is most optimized for the users browser
var config = {
  type: Phaser.AUTO,
  parent: 'phaser-example',
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 },
      setBounds: {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        autoResize: true,
    }
    }
  },
  // Embedded main game scene object that uses the following functions
  scene: {
    preload: preload,
    create: create,
    update: update
  } 
};

// Create a new instance of the game and pass the Phaser config above  
var game = new Phaser.Game(config);
var socket;
var totalPlayers;
var stateText;
var statusText;
var playersConnectedText;
var playersVoteToPlayAgain;
var startingXPos;
var startingYPos;
var gameStatus;
var replayButton;
var team;
var blueScoreBoard;
var redScoreBoard;
var disconnectedText;
var connectionRefusedText;
var didVote;

// Function that loads images into the server to be used on the webpage
function preload() {
  this.load.image('blueBall', 'resources/blueball.png');
  this.load.image('redBall', 'resources/redball.png');
  this.load.image('background', 'resources/background.png');
  this.load.image('speedPowerUp', 'resources/speedPowerUp.png');
  this.load.image('blueFlag', 'resources/blueflag.png');
  this.load.image('redFlag', 'resources/redflag.png');
}

// Function called to create the instance of the game, deals with event handlers from the server
function create() {

  // Create a socket connection for the player
  var self = this;
  this.socket = io();
  socket = this.socket;

  // Setup game background
  var windowWidth = window.innerWidth;
  var windowHeight = window.innerHeight;
  background = this.add.tileSprite(400, 400, windowWidth, windowHeight, 'background');

  this.physics.world.setBoundsCollision(true,true,true,true);

  // Add a Phaser group that allows us to manage game objects and control them as one unit
  this.otherPlayers = this.physics.add.group();

  // Use Phaser's built-in keyboard manager to handle movement of players
  this.cursors = this.input.keyboard.createCursorKeys();

  replayButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  
  // Event listener for the socket that loops through and checks if the player is already a part of the game, if not adds their id into the keys array
  this.socket.on('playerList', function (players) {
    Object.keys(players).forEach(function (id) {
      if (players[id].playerId === self.socket.id) {
        createPlayer(self, players[id]);
      } else {
        createOtherPlayers(self, players[id]);
      }
    });
  });
  
  this.socket.on('newPlayer', function (playerInfo) {
    createOtherPlayers(self, playerInfo);
  });
  
  this.socket.on('disconnect', function (playerId) {
    totalPlayers--;
    self.otherPlayers.getChildren().forEach(function (otherPlayer) {
      if (playerId === otherPlayer.playerId) {
        otherPlayer.destroy();
      }
    });
  });

  this.socket.on('opponentsMoved', function (playerInfo) {
    self.otherPlayers.getChildren().forEach(function (otherPlayer) {
      if (playerInfo.playerId === otherPlayer.playerId) {
        otherPlayer.setPosition(playerInfo.x, playerInfo.y);
      }
    });
  });

  this.socket.on('speedPowerUpLocation', function (speedPowerUpLocation) {
    if (self.speedPowerUp) self.speedPowerUp.destroy();
    self.speedPowerUp = self.physics.add.image(speedPowerUpLocation.x, speedPowerUpLocation.y, 'speedPowerUp').setDisplaySize(50, 50);
    self.physics.add.overlap(self.playerBall, self.speedPowerUp, function () {
      // Power up to double players velocity
      self.playerBall.setMaxVelocity(600);
      this.socket.emit('speedPowerUpCollected');
    }, null, self);
  });

  this.socket.on('redFlagLocation', function (redFlagLocation) {
    if (self.redFlag) self.redFlag.destroy();
    self.redFlag = self.physics.add.image(redFlagLocation.x, redFlagLocation.y, 'redFlag').setDisplaySize(60, 60);
    self.physics.add.overlap(self.playerBall, self.redFlag, function () {
      if(team === 'blue') {
        this.socket.emit('redFlagCollected');
      }
    }, null, self);
  });

  this.socket.on('blueFlagLocation', function (blueFlagLocation) {
    if (self.blueFlag) self.blueFlag.destroy();
    self.blueFlag = self.physics.add.image(blueFlagLocation.x, blueFlagLocation.y, 'blueFlag').setDisplaySize(60, 60);
    self.physics.add.overlap(self.playerBall, self.blueFlag, function () {
      if(team === 'red') {
        this.socket.emit('blueFlagCollected');
      }
    }, null, self);
  });

  blueScoreBoard = this.add.text(165, 16, '', { font: '26px Impact', fill: '#0000FF' });
  redScoreBoard = this.add.text(584, 16, '', { font: '26px Impact', fill: '#FF0000' });

  playersConnectedText = this.add.text(300, 16, '', { font: '26px Impact', fill: '#000000' });
  playersVoteToPlayAgain = this.add.text(350, 450, '', { font: '26px Impact', fill: '#000000' });
  
  connectionRefusedText = this.add.text(30, 100, 'CONNECTION REFUSED, FULL GAME ALREADY IN PROGRESS!', { font: '32px Impact', fill: '#000000' });

  stateText = this.add.text(150,550,'NOT ENOUGH PLAYERS! WAIT FOR 4 TO CONNECT!', { font: '26px Impact', fill: '#ff0000' });
  stateText.visible = false;

  disconnectedText = this.add.text(150,550,'PLAYER DISCONNECTED! Waiting for another player!', { font: '26px Impact', fill: '#ff0000' });        
  disconnectedText.visible = false;

  startText = this.add.text(300, 550, 'GAME HAS BEGUN!', { font: '26px Impact', fill: '#ff0000' });
  startText.visible = false;

  // Text to display status of game after round
  statusText = this.add.text(135, 100, '', { font: '40px Impact', fill: '#000000' });
  statusText.setAlign('center');
  statusText.visible = false;            
  
  this.socket.on('updateScoreBoard', function (scoreBoard) {
    blueScoreBoard.setText('Blue: ' + scoreBoard.blueTeam);
    redScoreBoard.setText('Red: ' + scoreBoard.redTeam);

    // Check for game winning conditions
    if(scoreBoard.blueTeam >= 25) {
      gameStatus = false;
      statusText.visible = true;
      startText.visible = false;
      statusText.setText('Blue Team Won!\nPress Space to vote to play again!');
      self.playerBall.setMaxVelocity(0);
    }
    if(scoreBoard.redTeam >= 25) {
      gameStatus = false;
      statusText.visible = true;
      startText.visible = false;
      statusText.setText('Red Team Won!\nPress Space to vote to play again!');
      self.playerBall.setMaxVelocity(0);
    }
  });

  this.socket.on('clientsVoteUpdate', function (voteCount) {
    playersVoteToPlayAgain.setText(voteCount + '/4 Ready!');
  });

  this.socket.on('clientsConnectedUpdate', function (totalPlayers) {
    self.totalPlayers = totalPlayers;
    connectionRefusedText.visible = false;

    if(totalPlayers === 4) {
      stateText.visible = false;
      statusText.visible = false;
      startText.visible = true;
      // Enable the players to move when the game is started when 4 players join
      self.playerBall.setMaxVelocity(300); 
      gameStatus = true;
      didVote = false;
    } else if (totalPlayers < 4){
      if(gameStatus === false) {
        gameStatus = false
        playersVoteToPlayAgain.visible = false;
        socket.emit('resetScoreBoard');
        socket.emit('resetVotes');
      }
      if(gameStatus === true) {
        stateText.setText('   Player Disconnected, Wait for rejoin!');
      }
      startText.visible = false;
      stateText.visible = true;
      self.playerBall.setMaxVelocity(0);
    }
    playersConnectedText.setText('Number Of Clients: ' + totalPlayers);
  });

  this.socket.on('playAgain', function (voteCount) {
    
    // Set the game status to playing a game
    gameStatus = true;
    startText.visible = true;
    didVote = false;
    
    // Unlock the players movement to play again
    self.playerBall.setMaxVelocity(300);
    
    playersVoteToPlayAgain.visible = false;

    // Restart Balls Position
    self.playerBall.x = startingXPos;
    self.playerBall.y = startingYPos;

    statusText.visible = false;
  });
}

// Phaser's function that continually sends and updates messages between client/server to check for input
function update() {
  // Based on input pressed, set ball velocity
  if (this.playerBall) {
    if (this.cursors.up.isDown && this.cursors.left.isDown) {
      this.playerBall.setAccelerationY(-800);
      this.playerBall.setAccelerationX(-800);
    }
    else if (this.cursors.up.isDown && this.cursors.right.isDown) {
      this.playerBall.setAccelerationY(-800);
      this.playerBall.setAccelerationX(800);
    }
    else if (this.cursors.down.isDown && this.cursors.left.isDown) {
      this.playerBall.setAccelerationY(800);
      this.playerBall.setAccelerationX(-800);
    }
    else if (this.cursors.down.isDown && this.cursors.right.isDown) {
      this.playerBall.setAccelerationY(800);
      this.playerBall.setAccelerationX(800);
    }
    else if (this.cursors.up.isDown) {
      this.playerBall.setAccelerationY(-800);
    } else if (this.cursors.down.isDown) {
      this.playerBall.setAccelerationY(800);
    } else if (this.cursors.left.isDown) {
      this.playerBall.setAccelerationX(-800);
    } else if (this.cursors.right.isDown) {
      this.playerBall.setAccelerationX(800);
    } else {
      this.playerBall.setAccelerationX(0);
      this.playerBall.setAccelerationY(0);
    }
    
    // Transmit player movement
    var x = this.playerBall.x;
    var y = this.playerBall.y;
    if (this.playerBall.previousPosition && (x !== this.playerBall.previousPosition.x || y !== this.playerBall.previousPosition.y)) {
      this.socket.emit('opponentMoved', { x: this.playerBall.x, y: this.playerBall.y});
    }
    // Save old coordinate position of playerBall
    this.playerBall.previousPosition = {
      x: this.playerBall.x,
      y: this.playerBall.y,
    };

    // Check if the game is over, if it is, allow placer to press spacebar to vote to play another round
    if(Phaser.Input.Keyboard.JustDown(replayButton) && gameStatus == false && didVote == false) {
      didVote = true;
      playersVoteToPlayAgain.visible = true;
      this.socket.emit('voteToPlayAgain');
    }
  } 

}

// Create Sprite for phaser and set its position with the information sent from the server
function createPlayer(self, playerInfo) {
  totalPlayers++;
  if (playerInfo.team === 'blue') {
    self.playerBall = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'blueBall').setOrigin(0.5, 0.5).setDisplaySize(35, 35).setCollideWorldBounds(true);
    team = 'blue';
    startingXPos = playerInfo.x;
    startingYPos = playerInfo.y;
  } else {
    self.playerBall = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'redBall').setOrigin(0.5, 0.5).setDisplaySize(35, 35).setCollideWorldBounds(true);
    team = 'red';
    startingXPos = playerInfo.x;
    startingYPos = playerInfo.y;
  }
  self.playerBall.setDrag(100);
  self.playerBall.setMaxVelocity(0);

}

// Create sprite for the other players and update their positions based on the information sent from the server
function createOtherPlayers(self, playerInfo) {
  var otherPlayer;
  totalPlayers++;
  if (playerInfo.team === 'blue') {
    otherPlayer = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'blueBall').setOrigin(0.5, 0.5).setDisplaySize(35, 35).setCollideWorldBounds(true);
  } else {
    otherPlayer = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'redBall').setOrigin(0.5, 0.5).setDisplaySize(35, 35).setCollideWorldBounds(true);
  }
  otherPlayer.playerId = playerInfo.playerId;
  self.otherPlayers.add(otherPlayer);
}