import React, {useEffect, useRef} from "react";
import {v1 as uuid} from "uuid";

const CreateRoom = (props) => {
    const videoRef = useRef()

    useEffect(() => {
        const constraints = {video: true}

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                videoRef.current.srcObject = stream
            }).catch(err => {
            console.log(`getUserMedia failed: `, err)
        })

    }, [])


    return (
        <div>
            <video ref={videoRef} autoPlay/>
        </div>
    );
}

export default CreateRoom;
