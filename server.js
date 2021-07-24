const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);

const rooms = {};

io.on("connection", socket => {
    socket.on('offerOrAnswer', payload => {
        console.log("receive offerOrAnswer")
        socket.broadcast.emit('offerOrAnswer', payload)
    })

    socket.on('ice-candidate', payload => {
        console.log('receive ice-candidate')
        socket.broadcast.emit('ice-candidate', payload)
    })
});


server.listen(8000, () => console.log('server is running on port 8000'));
