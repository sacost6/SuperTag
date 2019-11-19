var players = {};
var connectedClients = 0;
var playAgain = 0;

var speedPowerUp = {
  x: 400,
  y: 250
};

var blueFlag = {
  x: Math.floor(Math.random() * 450) + 30,
  y: Math.floor(Math.random() * 300) + 30
};

var redFlag = {
  x: Math.floor(Math.random() * 450) + 30,
  y: Math.floor(Math.random() * 300) + 30
};

var scoreBoard = {
  blueTeam: 0,
  redTeam: 0
};

var express = require('express');
// Create an instance of express module and call it app
var app = express();
// Send app module to server to handle the HTTP requests
var server = require('http').Server(app);
// Reference the socket.io module and listen to the server object
var io = require('socket.io').listen(server);
// Object to keep track of the players in the game

// Server static files from /public dir using expressJS
app.use(express.static(__dirname + '/public'));

// Tell the server that the root page is index.html 
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

// Logic to listen for connections and disconnections from the server 
io.on('connection', function (socket) {
  // Logic to handle if more than 4 players try to join the server, it will refuse connection to the server
  if (io.engine.clientsCount > 4) {
    socket.emit('ERROR:', { message: 'reached the limit of connections' })
    socket.disconnect()
    console.log('Disconnected due to too many clients, game in progress...')
    return
  }
  
  console.log('user connected');
  connectedClients++;

  // create a new player and add it to our players object
  players[socket.id] = {
    x: getPositions(connectedClients, 'x'),
    y: getPositions(connectedClients, 'y'),
    playerId: socket.id,
    team: getTeam(connectedClients),
  };
  // Send the players object to the new player
  socket.emit('playerList', players);

  // Send the speed powerup object to the new player
  socket.emit('speedPowerUpLocation', speedPowerUp);

  // Send the speed powerup object to the new player
  socket.emit('blueFlagLocation', blueFlag);

  // Send the speed powerup object to the new player
  socket.emit('redFlagLocation', redFlag);
  
  // Send the current scores to the clients
  socket.emit('updateScoreBoard', scoreBoard);
  
  // Update Clients Connected across all clients
  socket.emit('clientsConnectedUpdate', connectedClients);
  socket.broadcast.emit('clientsConnectedUpdate', connectedClients);

  // Update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);
  
  // On 'disconnect' log the user disconnected
  socket.on('disconnect', function () {
    console.log('user disconnected');
    connectedClients--;
    // Update Clients Connected
    socket.broadcast.emit('clientsConnectedUpdate', connectedClients);
    // Remove player from game
    delete players[socket.id];
    // emit a message to all players to remove this player
    io.emit('disconnect', socket.id);
  });

  // when an opponent moves, update the player data
  socket.on('opponentMoved', function (movementData) {
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;;
    // emit a message to all players about the player that moved
    socket.broadcast.emit('opponentsMoved', players[socket.id]);
  });

  socket.on('speedPowerUpCollected', function () {
    speedPowerUp.x = Math.floor(Math.random() * 350 + 20);
    speedPowerUp.y = Math.floor(Math.random() * 350 + 20);
    io.emit('speedPowerUpLocation', speedPowerUp);;
  });

  socket.on('blueFlagCollected', function () {
    scoreBoard.redTeam += 5;

    blueFlag.x = Math.floor(Math.random() * 450) + 30;
    blueFlag.y = Math.floor(Math.random() * 300) + 30;
    io.emit('blueFlagLocation', blueFlag);
    io.emit('updateScoreBoard', scoreBoard);
  });

  socket.on('redFlagCollected', function () {
    scoreBoard.blueTeam += 5;
    
    redFlag.x = Math.floor(Math.random() * 450) + 30;
    redFlag.y = Math.floor(Math.random() * 300) + 30;
    io.emit('redFlagLocation', redFlag);
    io.emit('updateScoreBoard', scoreBoard);
    });

  socket.on('voteToPlayAgain', function () {
    playAgain++;
    io.sockets.emit('clientsVoteUpdate', playAgain);

    if(playAgain === 4) {
      playAgain = 0;
      scoreBoard.blueTeam = 0;
      scoreBoard.redTeam = 0;
      io.sockets.emit('playAgain', playAgain);
      io.sockets.emit('updateScoreBoard', scoreBoard);

    }
  });

  socket.on('resetScoreBoard', function () {
    scoreBoard.blueTeam = 0;
    scoreBoard.redTeam = 0;

    io.sockets.emit('updateScoreBoard', scoreBoard);
  });

  socket.on('resetVotes', function () {
    playAgain = 0;

    io.sockets.emit('clientsVoteUpdate', scoreBoard);
  });
});

// Tell the server to listen to port 5555 and print to console if connected
server.listen(5555, function () {
  console.log(`Listening on ${server.address().port}`);
});

// Function used to calculate the corresponding x and y positions on the coordinate plane to set the players in their respective corners of map
function getPositions(connectedClients, coordinatePlane) {
  var xPos = 0;
  var yPos = 0;
  if(coordinatePlane === 'x')
  switch(connectedClients) {
    case 1:
      return xPos = 10;
    case 2:
      return xPos = 10;
    case 3:
      return xPos = 800;
    case 4:
      return xPos = 800;
    default:
      return xPos;
  }
  
  if(coordinatePlane === 'y') {
    switch(connectedClients) {
      case 1:
        return yPos = 10;
      case 2:
        return yPos = 600;
      case 3:
        return yPos = 10;
      case 4:
        return yPos = 600;
      default:
        return yPos;
    }
  }
}

// Function used to calculate which team the player will be on based on the total number of clients connected to the server
function getTeam(connectedClients) {
  switch(connectedClients) {
    case 1:
      return 'blue';
    case 2:
      return 'blue';
    case 3:
      return 'red';
    case 4:
      return 'red';
    default:
      return 'blue'
  }
}