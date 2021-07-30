import React, {useEffect, useRef, useState} from "react";
import {useLocation} from 'react-router'
import io from "socket.io-client";
import styled from 'styled-components';

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100vh;
    width: 90%;
    margin: auto;
    flex-wrap: wrap;
`;


const StyledVideo = styled.video`
    height: 40%;
    width: 40%;
    padding: 30px;
    background-color: black;
    background-clip: content-box;
`;

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        console.log('props.peer: ', props.peer)
        props.peer.ontrack = (e) => {
            console.log(`stream: `, e.stream);
            ref.current.srcObject = e.streams[0];
        };
    }, []);

    return (
        <StyledVideo playsInline autoPlay ref={ref}/>
    );
};

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


const CreateRoom = (props) => {
    const userVideoRef = useRef();
    const remoteVideoRef = useRef();
    const peerRef = useRef()
    const peersRef = useRef()
    const textRef = useRef()
    const socketRef = useRef()
    let iceCandidates = []

    let roomID = 1;
    const query = new URLSearchParams(useLocation().search);
    const role = query.get('role');

    const [peers, setPeers] = useState([])
    const [isBroadcaster, setBroadcaster] = useState(false);
    const [isViewer, setViewer] = useState(false);

    useEffect(() => {
        if (role === 'broadcaster') {
            setBroadcaster(true);
            setViewer(false);
        } else if (role === 'viewer') {
            setViewer(true);
            setBroadcaster(false);
        }
    }, [role]);

    useEffect(() => {
        socketRef.current = io.connect('ws://localhost:8000')

        switch (role) {
            case "broadcaster":
                console.log("role: ", role)
                navigator.mediaDevices.getUserMedia({video: true}).then(stream => {
                    // userVideoRef.current.srcObject = stream;
                    peerRef.current = new RTCPeerConnection({
                        iceServers: [
                            {
                                urls: "stun:stun.stunprotocol.org"
                            },
                            {
                                urls: 'turn:numb.viagenie.ca',
                                credential: 'muazkh',
                                username: 'webrtc@live.com'
                            },
                        ]
                    });
                    stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream))

                    socketRef.current.emit(event.BROAD_CASTER_JOIN_ROOM, roomID)

                    peerRef.current.createOffer({offerToReceiveVideo: true})
                        .then(desc => {
                            console.log(`desc: \n`, JSON.stringify(desc))
                            peerRef.current.setLocalDescription(desc).then(() => {
                                    const payload = {roomID, desc}
                                    console.log(`payload: `, payload)
                                    socketRef.current.emit(event.OFFER_FROM_BROADCASTER, payload)
                                }
                            ).catch(err => {
                                console.log(`setLocalDescription failed: `, err)
                            })
                        })

                    socketRef.current.on(event.OFFER_FROM_VIEWER, payload => {
                        console.log('on offer: ', payload)
                        const {desc, callerID} = payload
                        peerRef.current.setRemoteDescription(new RTCSessionDescription(desc)).then(() => {
                            console.log('set remote for broadcaster description success')
                        }).then(() => {
                            return peerRef.current.createAnswer()
                        }).then(answer => {
                            return peerRef.current.setLocalDescription(answer)
                        }).then(() => {
                            const payload = {
                                callerID,
                                roomID,
                                desc: peerRef.current.localDescription
                            }
                            console.log('payload: ', JSON.stringify(payload))
                            socketRef.current.emit(event.ANSWER_FROM_BROADCASTER, payload);
                        }).catch(err => {
                            console.log('set remote description for broadcaster failed ', err)
                        })
                    })

                    socketRef.current.on(event.ICE_CANDIDATE_FROM_VIEWER, payload => {
                        const {ice} = payload
                        const iceCandidate = new RTCIceCandidate(ice)
                        peerRef.current.addIceCandidate(iceCandidate).then(() => {
                            console.log('set ice-candidate success')
                        }).catch(err => {
                            console.log('set ice-candidate failed: ', err.name)
                        })
                    })

                    peerRef.current.ontrack = handleAddTrack;
                    peerRef.current.onicecandidate = handleBroadCasterSendIceCandidate;
                });
                break
            case "viewer":
                console.log("role: ", role)

                socketRef.current.emit(event.VIEWER_JOIN_ROOM, roomID)

                peerRef.current = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: "stun:stun.stunprotocol.org"
                        },
                        {
                            urls: 'turn:numb.viagenie.ca',
                            credential: 'muazkh',
                            username: 'webrtc@live.com'
                        },
                    ]
                })

                peers.push({
                    peer: peerRef.current
                })

                // viewer create offer
                peerRef.current.createOffer({offerToReceiveVideo: true})
                    .then(desc => {
                        console.log(`desc: \n`, JSON.stringify(desc))
                        peerRef.current.setLocalDescription(desc).then(() => {
                                const payload = {roomID, desc}
                                console.log(`payload: `, payload)
                                socketRef.current.emit(event.OFFER_FROM_VIEWER, payload)
                            }
                        ).catch(err => {
                            console.log(`setLocalDescription failed: `, err)
                        })
                    })

                // Nhận sự kiện offer từ server
                // SetRemoteDescription cho các viewer peer
                socketRef.current.on(event.OFFER_FROM_BROADCASTER, payload => {
                    console.log('on offer: ', payload)
                    const desc = new RTCSessionDescription(payload.desc)
                    peerRef.current.setRemoteDescription(desc).then(() => {
                        console.log('set remote description success')
                    }).catch(err => {
                        console.log('set remote description failed ', err)
                    })
                })

                socketRef.current.on(event.ANSWER_FROM_BROADCASTER, payload => {
                    const {desc} = payload
                    peerRef.current.setRemoteDescription(new RTCSessionDescription(desc)).then(() => {
                        console.log('set remote description success')
                    }).catch(err => {
                        console.log('set remote description failed ', err)
                    })
                })

                socketRef.current.on(event.ICE_CANDIDATE_FROM_BROADCASTER, payload => {
                    const iceCandidate = new RTCIceCandidate(payload)
                    peerRef.current.addIceCandidate(iceCandidate).then(() => {
                        console.log(`set ice-candidate for viewer success`)
                    }).catch(err => {
                        console.log('set ice-candidate failed: ', err.name)
                    })
                })

                // peerRef.current.ontrack = handleAddTrack;
                peerRef.current.onicecandidate = handleViewerSendCandidate;
                break
        }

    }, []);

    // TODO: Handle add track
    function handleAddTrack(e) {
        console.log("handleAddTrack")
        // remoteVideoRef.current.srcObject = e.streams[0]
    }

    // trigger when create offer
    // ice candidate event will trigger in background
    function handleViewerSendCandidate(e) {
        if (e.candidate) {
            console.log(JSON.stringify(e.candidate))
            socketRef.current.emit(event.ICE_CANDIDATE_FROM_VIEWER, {roomID, ice: e.candidate})
        }
    }

    function handleBroadCasterSendIceCandidate(e) {
        if (e.candidate) {
            console.log(JSON.stringify(e.candidate))
            socketRef.current.emit(event.ICE_CANDIDATE_FROM_BROADCASTER, {roomID, ice: e.candidate})
        }
    }

    return (
        <Container>
            {
                isViewer && peers.length > 0 && peers.map(peer => {
                    return (
                        <Video peer={peer.peer}/>
                    )
                })

            }
        </Container>

    );
}

export default CreateRoom;
