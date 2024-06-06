import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useNavigate } from "react-router-dom";

interface UserJoinedPayload {
  email: string;
  id: string;
}

interface IncomingCallPayload {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface NegoNeededIncomingCallPayload {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface CallAcceptedPayload {
  from: string;
  ans: RTCSessionDescriptionInit;
}

interface NegoNeededFinalPayload {
  ans: RTCSessionDescriptionInit;
}

const Room = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState("");
  const [myStream, setMyStream] = useState<MediaStream>();
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const navigate = useNavigate();

  const handleUserJoined = ({ email, id }: UserJoinedPayload) => {
    console.log(`email ${email} joined the room`);
    setRemoteSocketId(id);
  };

  const handleCallUser = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  };

  const handleIncomingCall = async ({ from, offer }: IncomingCallPayload) => {
    console.log(`Incoming call`, from, offer);
    setRemoteSocketId(from);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setMyStream(stream);
    const ans = await peer.getAnswer(offer);
    socket.emit("call:accepted", { to: from, ans });
  };

  const sendStreams = () =>{
    for (const track of myStream!.getTracks()) {
      peer.peer?.addTrack(track, myStream!);
    }
  }

  const handleCallAccepted = async ({ ans }: CallAcceptedPayload) => {
    try {
      await peer.setRemoteDescription(ans);
      console.log("Call Accepted");
      sendStreams();
    } catch (error) {
      console.error("Error setting local description for answer:", error);
    }
  };

  const handleNegoNeededIncoming = async({
    from,
    offer,
  }: NegoNeededIncomingCallPayload) => {
    const ans = await peer.getAnswer(offer);
    socket.emit("peer:nego:done", { to: from, ans });
  };

  const handleNegoNeededFinal = async ({ ans }: NegoNeededFinalPayload) => {
    await peer.setRemoteDescription(ans);
  };

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeededIncoming);
    socket.on("peer:nego:final", handleNegoNeededFinal);
    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeededIncoming);
      socket.off("peer:nego:final", handleNegoNeededFinal);
    };
  }, [socket, handleUserJoined, handleIncomingCall,handleCallAccepted,handleNegoNeededIncoming,handleNegoNeededFinal]);

  useEffect(() => {
    peer.peer?.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  const handleNegoNeeded = async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  };

  useEffect(() => {
    peer.peer?.addEventListener("negotiationneeded", handleNegoNeeded);

    return () => {
      peer.peer?.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const endCall = () => {
    // Close the connection
    peer.peer?.close();
    // Stop all tracks in myStream
    myStream?.getTracks().forEach(track => {
      track.stop();
    });
    // Reset streams and peer connection
    setMyStream(undefined);
    setRemoteStream(undefined);
    // Navigate user back to home page
    navigate("/");
  };

  const toggleVideo = () => {
    setVideoEnabled(prev => {
      const newState = !prev;
      myStream?.getVideoTracks().forEach(track => {
        track.enabled = newState;
      });
      return newState;
    });
  };

  const toggleAudio = () => {
    setAudioEnabled(prev => {
      const newState = !prev;
      myStream?.getAudioTracks().forEach(track => {
        track.enabled = newState;
      });
      return newState;
    });
  };

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Your are connected" : "No one in room"}</h4>
      {remoteSocketId && <button onClick={handleCallUser}>Call</button>}
      {myStream && <button onClick={sendStreams}>Send Stream</button>}
      {myStream && (
        <>
          <button onClick={toggleVideo}>
            {videoEnabled ? "Turn Video Off" : "Turn Video On"}
          </button>
          <button onClick={toggleAudio}>
            {audioEnabled ? "Mute Audio" : "Unmute Audio"}
          </button>
        </>
      )}
      {remoteSocketId && <button onClick={endCall}>End Call</button>}
      <h3>My Stream</h3>
      {myStream && (
        <ReactPlayer
          playing
          muted
          width="200px"
          height="200px"
          url={myStream}
        />
      )}
      <h3>Remote Stream</h3>
      {remoteStream && (
        <ReactPlayer
          playing
          width="200px"
          height="200px"
          url={remoteStream}
        />
      )}
    </div>
  );
};

export default Room;
