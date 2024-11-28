const socket = io('/');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001',
});

const myVideo = document.createElement('video');
myVideo.muted = true;

const peers = {};
const remoteVideos = {};
const remotePositions = {};

let x = 100;
let y = 100;
let videoWidth = 100;
let videoHeight = 100;

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
}).then((stream) => {
  addVideoStream(myVideo, stream);
  draw();

  myPeer.on('call', (call) => {
    call.answer(stream);
    const video = document.createElement('video');
    call.on('stream', (userVideoStream) => {
      addRemoteVideoStream(call.peer, video, userVideoStream);
    });
    call.on('close', () => {
      removeRemoteVideo(call.peer);
    });
  });

  socket.on('user-connected', (userId) => {
    setTimeout(() => connectToNewUser(userId, stream), 1000);
  });

  socket.on('user-disconnected', (userId) => {
    removeRemoteVideo(userId);
    if (peers[userId]) peers[userId].close();
  });

  socket.on('position-update', (data) => {
    remotePositions[data.userId] = { x: data.x, y: data.y };
  });
});

myPeer.on('open', (id) => {
  socket.emit('join-room', ROOM_ID, id);
});

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', (userVideoStream) => {
    addRemoteVideoStream(userId, video, userVideoStream);
  });
  call.on('close', () => {
    removeRemoteVideo(userId);
  });
  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => video.play());
}

function addRemoteVideoStream(userId, video, stream) {
  remoteVideos[userId] = { video, stream };
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => video.play());
}

function removeRemoteVideo(userId) {
  delete remoteVideos[userId];
  delete remotePositions[userId];
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (myVideo.readyState >= 2) {
    drawRoundedVideo(myVideo, x, y, videoWidth, videoHeight, 10);
  }

  for (const userId in remoteVideos) {
    const { video } = remoteVideos[userId];
    const position = remotePositions[userId] || { x: 100, y: 100 };
    if (video.readyState >= 2) {
      drawRoundedVideo(video, position.x, position.y, videoWidth, videoHeight, 10);
    }
  }

  requestAnimationFrame(draw);
}

function drawRoundedVideo(video, x, y, width, height, borderRadius) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + borderRadius, y);
  ctx.lineTo(x + width - borderRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + borderRadius);
  ctx.lineTo(x + width, y + height - borderRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - borderRadius, y + height);
  ctx.lineTo(x + borderRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - borderRadius);
  ctx.lineTo(x, y + borderRadius);
  ctx.quadraticCurveTo(x, y, x + borderRadius, y);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(video, x, y, width, height);

  ctx.restore();
}

window.addEventListener('keydown', (e) => {
  const moveAmount = 10;
  switch (e.key) {
    case 'ArrowUp':
      y = Math.max(0, y - moveAmount);
      break;
    case 'ArrowDown':
      y = Math.min(canvas.height - videoHeight, y + moveAmount);
      break;
    case 'ArrowLeft':
      x = Math.max(0, x - moveAmount);
      break;
    case 'ArrowRight':
      x = Math.min(canvas.width - videoWidth, x + moveAmount);
      break;
  }

  socket.emit('position-update', { userId: myPeer.id, x, y });
});
