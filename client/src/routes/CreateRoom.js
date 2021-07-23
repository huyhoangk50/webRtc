import React, {useEffect, useRef} from "react";
import io from "socket.io-client";

const CreateRoom = (props) => {
    const userVideoRef = useRef();
    const remoteVideoRef = useRef();
    const peerRef = useRef()
    const textRef = useRef()

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({video: true}).then(stream => {
            userVideoRef.current.srcObject = stream;
            peerRef.current = new RTCPeerConnection();
            stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream))
            // peerRef.current.addStream(stream)

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
        }
    }

    function createOffer() {
        peerRef.current.createOffer({offerToReceiveVideo: true})
            .then(desc => {
                console.log(`desc: \n`, JSON.stringify(desc))
                peerRef.current.setLocalDescription(desc).catch(err => {
                    console.log(`setLocalDescription failed: `, err)
                })
            })
    }

    function setRemoteDescription() {
        console.log("set remote description successfully")
        const desc = new RTCSessionDescription(JSON.parse(textRef.current.value))
        peerRef.current.setRemoteDescription(desc)
    }

    function answer() {
        peerRef.current.createAnswer().then(answer => {
            console.log(`Create answer `, JSON.stringify(answer))
            peerRef.current.setLocalDescription(answer).catch(err => {
                console.log(`Create answer failed `, err)
            })
        })
    }

    function setIceCandidate() {
        console.log(`Set ice candidate`)
        const iceCandidate = new RTCIceCandidate(JSON.parse(textRef.current.value))
        peerRef.current.addIceCandidate(iceCandidate).catch(err => {
            console.log(`AddIceCandidate error `, err)
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
            <button onClick={setRemoteDescription}>Set Remote description</button>
            <button onClick={setIceCandidate}>Set Ice candidate</button>
        </div>
    );
}

export default CreateRoom;
