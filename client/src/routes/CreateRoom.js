import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import io from "socket.io-client";
import styled from "styled-components";

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
    console.log("props.peer: ", props.peer);
    // props.peer.ontrack = (e) => {
    //   console.log(`stream: `, e.streams[0]);
    //   ref.current.srcObject = e.streams[0];
    // };
    props.peer.onaddstream = (event) => {
      console.log("onaddstream", event.stream)
      ref.current.srcObject = event.stream
    }
  }, []);

  return <StyledVideo playsInline autoPlay ref={ref} />;
};

const event = {
  BROAD_CASTER_JOIN_ROOM: "broadcaster-join-room",
  OFFER_FROM_BROADCASTER: "offer-from-broadcaster",
  ANSWER_FROM_BROADCASTER: "answer-from-broadcaster",
  ICE_CANDIDATE_FROM_BROADCASTER: "ice-candidate-from-broadcaster",

  VIEWER_JOIN_ROOM: "viewer-join-room",
  OFFER_FROM_VIEWER: "offer-from-viewer",
  ANSWER_FROM_VIEWER: "answer-from-viewer",
  ICE_CANDIDATE_FROM_VIEWER: "ice-candidate-from-viewer",

  CLEAR_ALL: "clear-all",
};

const CreateRoom = (props) => {
  const userVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();
  const peersRef = useRef([]);
  const textRef = useRef();
  const socketRef = useRef();
  let iceCandidates = [];

  let roomID = "868808038275142";
  const query = new URLSearchParams(useLocation().search);
  const role = query.get("role");

  const [peers, setPeers] = useState([]);
  const [isBroadcaster, setBroadcaster] = useState(false);
  const [isViewer, setViewer] = useState(false);



  useEffect(() => {
    if (role === "broadcaster") {
      setBroadcaster(true);
      setViewer(false);
    } else if (role === "viewer") {
      setViewer(true);
      setBroadcaster(false);
    }
  }, [role]);

  console.log("peers: ", peers);

  useEffect(() => {
    socketRef.current = io.connect('wss://vgps.vn')
    // socketRef.current = io.connect("ws://localhost:8000");

    switch (role) {
      case "broadcaster":
        console.log("role: ", role);
        socketRef.current.emit(event.CLEAR_ALL, { roomID });
        // Send event broadcaster join room
        socketRef.current.emit(event.BROAD_CASTER_JOIN_ROOM, { roomID });

        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
          // userVideoRef.current.srcObject = stream;

          // Khi 1 viewer join room, broadcaster sẽ nhận được sự kiện viewer-join-room
          // Broadcaster sẽ tạo 1 peer tương ứng với viewer mới giao để giao tiếp p2p
          // payload: {viewerID: socket.id}
          socketRef.current.on(event.VIEWER_JOIN_ROOM, (payload) => {
            const { viewerID } = payload;
            const peer = createPeer();

            peer.onicecandidate = handleBroadCasterSendIceCandidate;
            // add track to peer
            stream.getTracks().forEach((track) => peer.addTrack(track, stream));

            // Thêm vào peer vào list peer
            peersRef.current.push({
              peerID: viewerID,
              peer: peersRef.current,
            });

            // Tạo offer
            peer
              .createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: true,
              })
              .then((desc) => {
                // console.log(`desc: \n`, JSON.stringify(desc))
                peer
                  .setLocalDescription(desc)
                  .then(() => {
                    console.log("Set LOCAL description success");
                    const sendingPayload = { roomID, desc, viewerID };
                    console.log(`offer from broadcaster: `, sendingPayload);
                    socketRef.current.emit(
                      event.OFFER_FROM_BROADCASTER,
                      sendingPayload
                    );
                  })
                  .catch((err) => {
                    console.log(`setLocalDescription failed: `, err);
                  });
              });

            // Nhận answer
            // payload: {desc, viewerID: socket.id}
            socketRef.current.on(event.ANSWER_FROM_VIEWER, (payload) => {
              const { desc, viewerID } = payload;
              peer
                .setRemoteDescription(new RTCSessionDescription(desc))
                .then(() => {
                  console.log("Set Remote description success");
                })
                .catch((err) => {
                  console.log("Set Remote description failed ", err);
                });
            });

            socketRef.current.on(event.ICE_CANDIDATE_FROM_VIEWER, (payload) => {
              const { ice } = payload;
              const iceCandidate = new RTCIceCandidate(ice);
              peer
                .addIceCandidate(iceCandidate)
                .then(() => {
                  console.log("set ice-candidate success");
                })
                .catch((err) => {
                  console.log("set ice-candidate failed: ", err.name);
                });
            });

            peer.ontrack = handleAddTrack;
          });
        });
        break;
      case "viewer":
        console.log("role: ", role);

        socketRef.current.emit(event.VIEWER_JOIN_ROOM, { roomID });

        let iceCandidatesQueue = [];
        // Recive offer from broadcaster
        // {desc: desc, viewerID, broadcasterID: socket.id}
        socketRef.current.on(event.OFFER_FROM_BROADCASTER, (payload) => {
          console.log("event: ", event.OFFER_FROM_BROADCASTER);
          const { desc, viewerID, broadcasterID } = payload;
          const peer = createPeer();
          peer.onicecandidate = function (e) {
            console.log(JSON.stringify("sending ice candidate: ", e));
            if (e.candidate) {
              socketRef.current.emit(event.ICE_CANDIDATE_FROM_VIEWER, {
                roomID,
                ice: e.candidate,
              });
            }
          }

          peersRef.current.push({
            peerID: broadcasterID,
            peer: peer,
          });

          // peers.push({peer, peerID: broadcasterID})
          // setPeers(peers)
          setPeers((peers) => [...peers, { peer, peerID: broadcasterID }]);

          const remoteDescription = new RTCSessionDescription(desc);
          peer
            .setRemoteDescription(remoteDescription)
            .then(() => {
              console.log("Set REMOTE description success new code");
              if (iceCandidatesQueue) {
                iceCandidatesQueue.forEach(candidate => {
                  peer
                    .addIceCandidate(candidate)
                    .then(() => {
                      console.log(`set ice-candidate for from queue`);
                    })
                    .catch((err) => {
                      console.log("set ice-candidate failed: ", err.name);
                    });
                });
              }
              iceCandidatesQueue = null;
              var mediaConstraints = {
                'answerToReceiveAudio': true,
              };
              return peer.createAnswer(mediaConstraints);
            })
            .then((answer) => {
              console.log("Set LOCAL description success");
              return peer.setLocalDescription(answer);
            })
            .then(() => {
              const answerFromViewerPayload = {
                desc: peer.localDescription,
                broadcasterID,
                roomID,
              };
              socketRef.current.emit(
                event.ANSWER_FROM_VIEWER,
                answerFromViewerPayload
              );
            });

          socketRef.current.on(
            event.ICE_CANDIDATE_FROM_BROADCASTER,
            (payload) => {
              const iceCandidate = new RTCIceCandidate(payload.ice);
              if (peer.remoteDescription) {
                peer
                  .addIceCandidate(iceCandidate)
                  .then(() => {
                    console.log(`===set ice-candidate for success`);
                  })
                  .catch((err) => {
                    console.log("set ice-candidate failed: ", err.name);
                  });
              } else {
                console.log("add ice to queue");
                iceCandidatesQueue.push(iceCandidate);
              }
            }
          );

          peer.ontrack = handleAddTrack;
          peer.onaddstream = handleAddStream;
        });

        break;
    }
  }, []);

  function createPeer() {
    return new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
        {
          url: 'turn:192.158.29.39:3478?transport=udp',
          credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
          username: '28224511:1379330808'
        },
        {
          url: 'turn:192.158.29.39:3478?transport=tcp',
          credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
          username: '28224511:1379330808'
        },
        {
          url: 'turn:turn.anyfirewall.com:443?transport=tcp',
          credential: 'webrtc',
          username: 'webrtc'
        },
        {
          url: 'turn:turn.anyfirewall.com:443?transport=udp',
          credential: 'webrtc',
          username: 'webrtc'
        }
      ],
    });
  }

  // TODO: Handle add track
  function handleAddTrack(e) {
    console.log("handleAddTrack");
    // remoteVideoRef.current.srcObject = e.streams[0]
  }

  function handleAddStream(event) {
    console.info('onaddstream', event.stream);
  };

  // trigger when create offer
  // ice candidate event will trigger in background
  function handleViewerSendCandidate(e) {
    console.log(JSON.stringify("sending ice candidate", e.candidate));
    if (e.candidate) {
      socketRef.current.emit(event.ICE_CANDIDATE_FROM_VIEWER, {
        roomID,
        ice: e.candidate,
      });
    }
  }

  function handleBroadCasterSendIceCandidate(e) {
    if (e.candidate) {
      socketRef.current.emit(event.ICE_CANDIDATE_FROM_BROADCASTER, {
        roomID,
        ice: e.candidate,
      });
    }
  }

  return (
    <Container>
      {isViewer && <h1>Số lượng broadcaster: {peers.length} </h1>}

      {isViewer &&
        peers.length > 0 &&
        peers.map((peer, index) => {
          return <Video key={index} peer={peer.peer} />;
        })}
    </Container>
  );
};

export default CreateRoom;
