const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);

const event = {
    BROAD_CASTER_JOIN_ROOM: 'broadcaster-join-room',
    OFFER_FROM_BROADCASTER: 'offer-from-broadcaster',
    ANSWER_FROM_BROADCASTER: 'answer-from-broadcaster',
    ICE_CANDIDATE_FROM_BROADCASTER: 'ice-candidate-from-broadcaster',

    VIEWER_JOIN_ROOM: 'viewer_join_room',
    OFFER_FROM_VIEWER: 'offer-from-viewer',
    ANSWER_FROM_VIEWER: 'answer-from-viewer',
    ICE_CANDIDATE_FROM_VIEWER: 'ice-candidate-from-viewer'
}

const broadcasters = {};
const viewers = {};


io.on("connection", socket => {
    socket.on(event.BROAD_CASTER_JOIN_ROOM, roomID => {
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
                io.to(broadcaster).emit(event.OFFER_FROM_VIEWER, {desc: desc, callerID: socket.id})
            })
        }
    });

    socket.on(event.ICE_CANDIDATE_FROM_VIEWER, payload => {
        console.log(`ice candidate from viewer: `, payload.ice)
        const {roomID, ice} = payload
        if (broadcasters[roomID]?.length > 0) {
            broadcasters[roomID]?.forEach(broadcaster => {
                io.to(broadcaster).emit(event.ICE_CANDIDATE_FROM_VIEWER, {ice: ice})
            })
        }
    })

    socket.on(event.VIEWER_JOIN_ROOM, roomID => {
        console.log(`event ${event.VIEWER_JOIN_ROOM}`)
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
    })

    // viewer receive event from broadcaster
    // 1. Get list of all viewer
    // 2. Send offer to all viewer
    socket.on(event.OFFER_FROM_BROADCASTER, payload => {
        if (!payload) {
            console.log("receive offer from broadcaster event with data is: ", payload)
            return
        }

        console.log("receive offer from broadcaster event")
        const {roomID, desc} = payload
        console.log('viewer in room: ', viewers[roomID])
        if (viewers[roomID]?.length > 0) {
            viewers[roomID].forEach(viewer => {
                io.to(viewer).emit(event.OFFER_FROM_BROADCASTER, {desc: desc})
            })
        }
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
        if (broadcasters[roomID]?.length > 0) {
            broadcasters[roomID].forEach(broadcaster => {
                io.to(broadcaster).emit(event.ICE_CANDIDATE_FROM_BROADCASTER, {ice: ice})
            })
        }
    })
});


server.listen(8000, () => console.log('server is running on port 8000'));
