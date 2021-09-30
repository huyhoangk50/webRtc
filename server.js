const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const {inspect} = require('util');
const io = socket(server, {cors: {origin: '*'}});


const event = {
    BROAD_CASTER_JOIN_ROOM: 'broadcaster-join-room',
    OFFER_FROM_BROADCASTER: 'offer-from-broadcaster',
    ANSWER_FROM_BROADCASTER: 'answer-from-broadcaster',
    ICE_CANDIDATE_FROM_BROADCASTER: 'ice-candidate-from-broadcaster',

    VIEWER_JOIN_ROOM: 'viewer-join-room',
    OFFER_FROM_VIEWER: 'offer-from-viewer',
    ANSWER_FROM_VIEWER: 'answer-from-viewer',
    ICE_CANDIDATE_FROM_VIEWER: 'ice-candidate-from-viewer',

    VIEWER_LEFT: 'viewer-left',
    BROADCASTER_LEFT: 'broadcaster-left',
}

const broadcasters = {};
const viewers = {};
const socketToRoom = new Map();


io.on("connection", socket => {
    console.log("have socket connection");
    socket.on(event.BROAD_CASTER_JOIN_ROOM, ({roomID}) => {
        console.log(`event ${event.BROAD_CASTER_JOIN_ROOM}`)
        if (broadcasters[roomID]) {
            const length = broadcasters[roomID].length;
            if (length >= 3) {
                console.log(`Broadcaster reach limited`)
                socket.broadcast.emit('broadcaster reach limited')
                return
            }
            broadcasters[roomID].push(socket.id)
        } else {
            broadcasters[roomID] = [socket.id]
        }
        socketToRoom.set(socket.id, roomID);
        console.log(broadcasters[roomID])
    });

    // viewer receive event from broadcaster
    // 1. Get list of all viewer
    // 2. Send offer to all viewer
    socket.on(event.OFFER_FROM_VIEWER, payload => {
        console.log(`receive event ${event.OFFER_FROM_VIEWER}`)
        const {roomID, desc} = payload
        console.log(`roomID: ${roomID}  broadcaster in room: ${broadcasters[roomID]}`)
        if (broadcasters[roomID]?.length > 0) {
            broadcasters[roomID].forEach(broadcaster => {
                io.to(broadcaster).emit(event.OFFER_FROM_VIEWER, {desc, callerID: socket.id})
            })
        }
    });

    // payload: {desc, broadcasterID, roomID}
    socket.on(event.ANSWER_FROM_VIEWER, payload => {
        const {desc, broadcasterID, roomID} = payload
        io.to(broadcasterID).emit(event.ANSWER_FROM_VIEWER, {desc, viewerID: socket.id})
    })

    socket.on(event.ICE_CANDIDATE_FROM_VIEWER, payload => {
        console.log(`ice candidate from viewer: `, payload.ice)
        const {roomID, ice} = payload
        if (broadcasters[roomID]?.length > 0) {
            broadcasters[roomID]?.forEach(broadcaster => {
                io.to(broadcaster).emit(event.ICE_CANDIDATE_FROM_VIEWER, {ice: ice})
            })
        }
    })

    socket.on(event.VIEWER_JOIN_ROOM, ({roomID}) => {
        console.log(`event ${event.VIEWER_JOIN_ROOM}`)
        // lưu thông tin viewer vào list viewer
        if (viewers[roomID]) {
            const length = viewers[roomID].length;
            if (length >= 3) {
                console.log(`viewers reach limited`)
                socket.broadcast.emit('viewers reach limited')
                return
            }
            viewers[roomID].push(socket.id)
        } else {
            viewers[roomID] = [socket.id]
        }

        socketToRoom.set(socket.id, roomID);
        // Lấy thông tin của broadcaster trong room
        // Gửi sự kiện đến tất cả broadcaster thông báo có viewer mới join room
        if (broadcasters[roomID]?.length > 0) {
            broadcasters[roomID].forEach(broadcaster => {
                io.to(broadcaster).emit(event.VIEWER_JOIN_ROOM, {viewerID: socket.id})
            })
        }
    })

    // viewer receive event from broadcaster
    // 1. Get list of all viewer
    // 2. Send offer to all viewer
    // payload: {roomID, desc, viewerID}
    socket.on(event.OFFER_FROM_BROADCASTER, payload => {
        if (!payload) {
            console.log("receive offer from broadcaster event with data is: ", payload)
            return
        }

        console.log("receive offer from broadcaster event")
        const {roomID, desc, viewerID} = payload
        console.log('viewer in room: ', viewers[roomID])
        io.to(viewerID).emit(event.OFFER_FROM_BROADCASTER, {desc: desc, viewerID, broadcasterID: socket.id})
    });

    // Answer from broadcaster
    socket.on(event.ANSWER_FROM_BROADCASTER, payload => {
        console.log(`event: ${event.ANSWER_FROM_BROADCASTER}`)
        const {roomID, desc} = payload
        console.log('viewer in room: ', viewers[roomID])
        if (viewers[roomID]?.length > 0) {
            viewers[roomID].forEach(viewer => {
                io.to(viewer).emit(event.ANSWER_FROM_BROADCASTER, {desc: desc})
            })
        }
    })

    socket.on(event.ICE_CANDIDATE_FROM_BROADCASTER, payload => {
        const {roomID, ice} = payload
        if (viewers[roomID]?.length > 0) {
            viewers[roomID].forEach(viewer => {
                io.to(viewer).emit(event.ICE_CANDIDATE_FROM_BROADCASTER, {ice: ice})
            })
        }
    })

    socket.on('disconnect', () => {
        const roomID = socketToRoom.get(socket.id);

        const usersInRoom = viewers[roomID];
        if (usersInRoom && viewers[roomID].indexOf(socket.id) !== -1) {
            const remainUsers = usersInRoom.filter(id => id !== socket.id);
            viewers[roomID] = remainUsers;
            delete socketToRoom[socket.id];
            console.log(`Emit events viewer left. Viewer in room: ${inspect(viewers[roomID])} `);
            socket.broadcast.emit(event.VIEWER_LEFT, {viewerID: socket.id});
            return;
        }

        const broadcastersInRoom = broadcasters[roomID];
        if (broadcastersInRoom && broadcasters[roomID].indexOf(socket.id) !== -1) {
            console.log(`broadcastersInRoom: ${inspect(broadcastersInRoom)} id: ${socket.id}`);
            const remainBroadcaster = broadcastersInRoom.filter(id => id !== socket.id);
            broadcasters[roomID] = remainBroadcaster;
            delete socketToRoom[socket.id];
            console.log(`Emit events broadcaster left broadcaster remain: ${inspect(broadcasters[roomID])}`);
            if (viewers[roomID]?.length > 0) {
                viewers[roomID].forEach(viewer => {
                    io.to(viewer).emit(event.BROADCASTER_LEFT, {broadcasterID: socket.id});
                });
            }
            return;
        }
    });
});


server.listen(8000, () => console.log('server is running on port 8000'));
