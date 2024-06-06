import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import ReactPlayer from "react-player";
import { useNavigate } from "react-router-dom";
import peer from "../service/peer";

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
  const navigate = useNavigate();
  const [remoteSocketId, setRemoteSocketId] = useState("");
  const [myStream, setMyStream] = useState<MediaStream>();
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [isCallInitiated, setIsCallInitiated] = useState(false);
  const [isButtonsVisible, setIsButtonsVisible] = useState(false);

  const handleUserJoined = ({ email, id }: UserJoinedPayload) => {
    console.log(`email ${email} joined the room`);
    setRemoteSocketId(id);
    setIsCallInitiated(true); // Indicate that the call has been initiated
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
    setIsCallInProgress(true);
    setIsButtonsVisible(true); // Show buttons when call is in progress
  };

  const sendStreams = () => {
    for (const track of myStream!.getTracks()) {
      peer.peer?.addTrack(track, myStream!);
    }
    setIsButtonsVisible(true); // Show buttons after sending streams
  };

  const handleCallAccepted = async ({ ans }: CallAcceptedPayload) => {
    try {
      await peer.setRemoteDescription(ans);
      console.log("Call Accepted");
      sendStreams();
      setIsCallInProgress(true);
    } catch (error) {
      console.error("Error setting local description for answer:", error);
    }
  };

  const handleNegoNeededIncoming = async ({
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
  }, [socket]);

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

  const toggleAudio = () => {
    if (myStream) {
      myStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (myStream) {
      myStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const endCall = () => {
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
      setMyStream(undefined);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(undefined);
    }
    setIsCallInProgress(false);
    setIsButtonsVisible(false); // Hide buttons after ending the call
    navigate("/"); // Navigate to lobby after ending the call
  };

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Your are connected" : "No one in room"}</h4>
      {isCallInitiated && !isCallInProgress && (
        <button onClick={handleCallUser}>Call</button>
      )}
      {isCallInProgress && isButtonsVisible && (
        <>
          <button onClick={toggleAudio}>
            {isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
          </button>
          <button onClick={toggleVideo}>
            {isVideoEnabled ? "Mute Video" : "Unmute Video"}
          </button>
          <button onClick={endCall}>End Call</button>
        </>
      )}
      {!isCallInProgress && (
        <button onClick={sendStreams}>Send Streams</button>
      )}
      {myStream && (
        <>
          <h3>My Stream</h3>
          <ReactPlayer
            playing
            muted={!isCallInProgress || !isAudioEnabled}
            width="200px"
            height="200px"
            url={myStream}
          />
        </>
      )}
            {remoteStream && (
        <>
          <h3>Remote Stream</h3>
          <ReactPlayer
            playing
            muted={!isCallInProgress || !isAudioEnabled}
            width="200px"
            height="200px"
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default Room;
