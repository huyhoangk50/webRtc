import React, {useEffect, useRef} from "react";
import io from "socket.io-client";

const CreateRoom = (props) => {
    const userVideoRef = useRef();
    const remoteVideoRef = useRef();
    const peerRef = useRef()
    const textRef = useRef()
    const socketRef = useRef()
    let iceCandidates = []

    useEffect(() => {
        socketRef.current = io.connect('/')
        navigator.mediaDevices.getUserMedia({video: true}).then(stream => {
            userVideoRef.current.srcObject = stream;
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

            socketRef.current.on('offerOrAnswer', payload => {
                console.log('on offerOrAnswer: ', payload)
                textRef.current.value = JSON.stringify(payload)
                const desc = new RTCSessionDescription(payload)
                peerRef.current.setRemoteDescription(desc).then(() => {
                    console.log('set remote description success')
                }).catch(err => {
                    console.log('set remote description failed ', err)
                })
            })

            socketRef.current.on('ice-candidate', payload => {
                const iceCandidate = new RTCIceCandidate(payload)
                peerRef.current.addIceCandidate(iceCandidate).then(() => {
                    console.log('set ice-candidate success')
                }).catch(err => {
                    console.log('set ice-candidate failed: ', err.name)
                })
            })

            peerRef.current.ontrack = handleAddTrack;
            peerRef.current.onicecandidate = handleIceCandidate;
            peerRef.current.onnegotiationneeded = handleNegotiationNeededEvent;
        });
    }, []);

    function handleAddTrack(e) {
        console.log("handleAddTrack")
        remoteVideoRef.current.srcObject = e.streams[0]
    }

    function handleNegotiationNeededEvent(e) {
        console.log('handleNegotiationNeededEvent: ', e)
    }

    // trigger when a new candidate is returned
    function handleIceCandidate(e) {
        if (e.candidate) {
            console.log(JSON.stringify(e.candidate))
            socketRef.current.emit('ice-candidate', e.candidate)
        }
    }

    function createOffer() {
        peerRef.current.createOffer({offerToReceiveVideo: true})
            .then(desc => {
                console.log(`desc: \n`, JSON.stringify(desc))
                peerRef.current.setLocalDescription(desc).then(() =>
                    socketRef.current.emit('offerOrAnswer', desc)
                ).catch(err => {
                    console.log(`setLocalDescription failed: `, err)
                })
            })
    }

    function answer() {
        peerRef.current.createAnswer().then(answer => {
            console.log(`Create answer `, JSON.stringify(answer))
            peerRef.current.setLocalDescription(answer).then(() => {
                socketRef.current.emit('offerOrAnswer', answer)
            }).catch(err => {
                console.log(`Create answer failed `, err)
            })
        })
    }

    return (
        <div>
            <video autoPlay ref={userVideoRef}/>
            <video autoPlay ref={remoteVideoRef}/>
            <br/>
            <button onClick={createOffer}>Create offer</button>
            <button onClick={answer}>Answer</button>
            <br/>
            <textarea ref={textRef} rows={50} cols={70}/>
            <br/>
        </div>
    );
}

export default CreateRoom;
